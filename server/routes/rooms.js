import express from 'express';
import multer from 'multer';
import { optionalAuth } from '../middleware/auth.js';
import { log } from '../services/logger.js';
import { useDb, supabaseAdmin, fallback } from '../services/db.js';
import { saveFileLocally } from '../services/fileStorage.js';
import {
  parseFloorplanWithPython,
  unavailableParseResult,
  buildFloorplanClientPayload,
  buildRoomUpdatesFromParse,
} from '../services/floorplanParse.js';
import { enrichRoomPlacements, enrichRoomsPlacements } from '../services/placementEnrichment.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hasDbUserId = (userId) => typeof userId === 'string' && UUID_RE.test(userId);

function attachInteriorFields(room) {
  if (!room) return room;
  if (!room.interior && room.detected_objects?.interior) {
    room.interior = room.detected_objects.interior;
  }
  return room;
}

// POST /api/rooms — create a new room
router.post('/', optionalAuth, async (req, res) => {
  const { name, unit, width, depth } = req.body;
  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (dbEnabled) {
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .insert({ user_id: req.user.id, name: name || 'My Room', unit: unit || 'inches', width: width || null, depth: depth || null })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }
  // Fallback
  const room = fallback.createRoom(req.user.id, { name, unit, width, depth });
  res.json(room);
});

// GET /api/rooms — list user rooms
router.get('/', optionalAuth, async (req, res) => {
  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (dbEnabled) {
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .select('*, placements(*)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    const enriched = await enrichRoomsPlacements(data, true);
    return res.json(enriched);
  }
  const rooms = fallback.getRooms(req.user.id);
  res.json(await enrichRoomsPlacements(rooms, false));
});

// GET /api/rooms/:id
router.get('/:id', optionalAuth, async (req, res) => {
  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (dbEnabled) {
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .select('*, placements(*)')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();
    if (error) return res.status(404).json({ error: 'Room not found' });
    // If zones column missing, fall back to detected_objects.zones
    if (!data.zones && data.detected_objects?.zones) {
      data.zones = data.detected_objects.zones;
    }
    const enriched = attachInteriorFields(await enrichRoomPlacements(data, true));
    return res.json(enriched);
  }
  const room = fallback.getRoom(req.params.id, req.user.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(attachInteriorFields(await enrichRoomPlacements(room, false)));
});

// PUT /api/rooms/:id
router.put('/:id', optionalAuth, async (req, res) => {
  const { name, width, depth, height, walls, scale_px_per_inch, unit, zones, interior } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (width !== undefined) updates.width = width;
  if (depth !== undefined) updates.depth = depth;
  if (height !== undefined) updates.height = height;
  if (walls !== undefined) updates.walls = walls;
  if (scale_px_per_inch !== undefined) updates.scale_px_per_inch = scale_px_per_inch;
  if (unit !== undefined) updates.unit = unit;
  if (zones !== undefined) updates.zones = zones;

  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (interior !== undefined) {
    if (dbEnabled) {
      const { data: current } = await supabaseAdmin
        .from('rooms')
        .select('detected_objects')
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .maybeSingle();
      updates.detected_objects = { ...(current?.detected_objects || {}), interior };
    } else {
      updates.interior = interior;
    }
  }

  if (dbEnabled) {
    updates.updated_at = new Date().toISOString();
    let { data, error } = await supabaseAdmin
      .from('rooms')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();
    // Retry without zones if the column is missing on this deployment
    if (error && /zones/i.test(error.message || '') && 'zones' in updates) {
      const { zones: _skipped, ...rest } = updates;
      ({ data, error } = await supabaseAdmin
        .from('rooms')
        .update(rest)
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .select()
        .single());
      // Stash zones in detected_objects as a fallback so the client still sees them
      if (!error && data) {
        const merged = { ...(data.detected_objects || {}), zones };
        await supabaseAdmin.from('rooms').update({ detected_objects: merged }).eq('id', req.params.id).eq('user_id', req.user.id);
        data.zones = zones;
        data.detected_objects = merged;
      }
    }
    if (error) return res.status(400).json({ error: error.message });
    return res.json(attachInteriorFields(data));
  }
  const room = fallback.updateRoom(req.params.id, req.user.id, updates);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (interior !== undefined && !room.interior) {
    room.interior = interior;
    room.detected_objects = { ...(room.detected_objects || {}), interior };
  }
  return res.json(attachInteriorFields(room));
});

// DELETE /api/rooms/:id
router.delete('/:id', optionalAuth, async (req, res) => {
  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (dbEnabled) {
    const { error } = await supabaseAdmin
      .from('rooms')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  }
  fallback.deleteRoom(req.params.id, req.user.id);
  res.json({ success: true });
});

// POST /api/rooms/:id/upload-floorplan
router.post('/:id/upload-floorplan', optionalAuth, upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    // 1. Upload to Supabase Storage, fall back to local file
    let publicUrl = null;
    try {
      const ext = file.originalname.split('.').pop();
      const fileName = `${req.user.id}/${id}/floorplan-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from('floor-plans')
        .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });
      if (!uploadError) {
        const urlRes = supabaseAdmin.storage.from('floor-plans').getPublicUrl(fileName);
        publicUrl = urlRes.data.publicUrl;
      }
    } catch (storageErr) {
      log.warn('Storage upload failed (non-fatal)', { error: storageErr.message });
    }

    // Fallback: save locally if Supabase Storage didn't work
    if (!publicUrl) {
      const localPath = saveFileLocally(file.buffer, 'floor-plans', file.originalname);
      publicUrl = localPath; // e.g. /uploads/floor-plans/12345-plan.jpg
    }

    // 2. Python service — GPT vision grid + wall-snap (preferred), OpenCV fallback
    let parseResult;
    try {
      parseResult = await parseFloorplanWithPython(file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    } catch (pyErr) {
      parseResult = unavailableParseResult(pyErr);
    }

    const clientPayload = buildFloorplanClientPayload(parseResult);

    // 3. Save URL + parsed data to room
    const roomUpdates = {
      floor_plan_url: publicUrl,
      ...buildRoomUpdatesFromParse(parseResult),
    };

    const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
    if (dbEnabled) {
      roomUpdates.updated_at = new Date().toISOString();
      await supabaseAdmin
        .from('rooms')
        .update(roomUpdates)
        .eq('id', id)
        .eq('user_id', req.user.id);
    } else {
      fallback.updateRoom(id, req.user.id, roomUpdates);
    }

    res.json({
      floor_plan_url: publicUrl,
      ...clientPayload,
    });
  } catch (err) {
    log.error('Floor plan upload error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms/:id/calibrate
router.post('/:id/calibrate', optionalAuth, async (req, res) => {
  const { p1, p2, real_world_inches } = req.body;
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const pixel_dist = Math.sqrt(dx * dx + dy * dy);
  const scale_px_per_inch = pixel_dist / real_world_inches;

  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (dbEnabled) {
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .update({ scale_px_per_inch, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ scale_px_per_inch, room: data });
  }
  const room = fallback.updateRoom(req.params.id, req.user.id, { scale_px_per_inch });
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ scale_px_per_inch, room });
});

export default router;
