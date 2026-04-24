import express from 'express';
import multer from 'multer';
import FormData from 'form-data';
import axios from 'axios';
import { optionalAuth } from '../middleware/auth.js';
import { useDb, supabaseAdmin, fallback } from '../services/db.js';
import { saveFileLocally } from '../services/fileStorage.js';
import { normalizeZones } from '../services/normalizeZones.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/rooms — create a new room
router.post('/', optionalAuth, async (req, res) => {
  const { name, unit, width, depth } = req.body;
  if (await useDb()) {
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
  if (await useDb()) {
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .select('*, placements(*)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }
  res.json(fallback.getRooms(req.user.id));
});

// GET /api/rooms/:id
router.get('/:id', optionalAuth, async (req, res) => {
  if (await useDb()) {
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
    return res.json(data);
  }
  const room = fallback.getRoom(req.params.id, req.user.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});

// PUT /api/rooms/:id
router.put('/:id', optionalAuth, async (req, res) => {
  const { name, width, depth, height, walls, scale_px_per_inch, unit, zones } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (width !== undefined) updates.width = width;
  if (depth !== undefined) updates.depth = depth;
  if (height !== undefined) updates.height = height;
  if (walls !== undefined) updates.walls = walls;
  if (scale_px_per_inch !== undefined) updates.scale_px_per_inch = scale_px_per_inch;
  if (unit !== undefined) updates.unit = unit;
  if (zones !== undefined) updates.zones = zones;

  if (await useDb()) {
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
    return res.json(data);
  }
  const room = fallback.updateRoom(req.params.id, req.user.id, updates);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});

// DELETE /api/rooms/:id
router.delete('/:id', optionalAuth, async (req, res) => {
  if (await useDb()) {
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
      console.warn('Storage upload failed (non-fatal):', storageErr.message);
    }

    // Fallback: save locally if Supabase Storage didn't work
    if (!publicUrl) {
      const localPath = saveFileLocally(file.buffer, 'floor-plans', file.originalname);
      publicUrl = localPath; // e.g. /uploads/floor-plans/12345-plan.jpg
    }

    // 2. Send to Python service for parsing
    let parseResult = { rooms: [], walls: [], fallback: true, error: 'Python service unavailable — set room dimensions manually' };
    try {
      const form = new FormData();
      form.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });

      const pythonRes = await axios.post(
        `${process.env.PYTHON_SERVICE_URL || 'http://localhost:5001'}/parse-floorplan`,
        form,
        { headers: form.getHeaders(), timeout: 120000 }
      );
      parseResult = pythonRes.data;
    } catch (pyErr) {
      console.warn('Python service unavailable:', pyErr.message);
    }

    // 3. Save URL + parsed data to room
    const roomUpdates = { floor_plan_url: publicUrl };

    // If rooms/walls were detected, save them to the room record
    if (parseResult.walls && parseResult.walls.length > 0) {
      roomUpdates.walls = parseResult.boundary
        ? parseResult.walls.map(([x, y]) => [x - parseResult.boundary.x, y - parseResult.boundary.y])
        : parseResult.walls;
    }

    // Auto-calculate room dimensions from boundary
    const boundary = parseResult.boundary;
    const imgW = parseResult.image_width;
    const imgH = parseResult.image_height;
    if (boundary && boundary.w > 0 && imgW && imgH) {
      let calcScale = 1.0;
      let roomW = Math.round(boundary.w);
      let roomH = Math.round(boundary.h);

      if (parseResult.total_width_inches && parseResult.total_width_inches > 0) {
        // scale = pixels / inches
        calcScale = boundary.w / parseResult.total_width_inches;
        roomW = Math.round(parseResult.total_width_inches);
        roomH = Math.round(boundary.h / calcScale);
      } else if (parseResult.total_depth_inches && parseResult.total_depth_inches > 0) {
        calcScale = boundary.h / parseResult.total_depth_inches;
        roomH = Math.round(parseResult.total_depth_inches);
        roomW = Math.round(boundary.w / calcScale);
      }

      roomUpdates.width = roomW;
      roomUpdates.depth = roomH;
      roomUpdates.scale_px_per_inch = calcScale;
    }

    // Store detected room data (rooms, boundary) as detected_objects for reference
    if (parseResult.rooms || parseResult.boundary) {
      const zones = normalizeZones(parseResult);
      if (zones.length > 0) {
        roomUpdates.zones = zones;
      }
      roomUpdates.detected_objects = {
        rooms: parseResult.rooms || [],
        zones,
        boundary: parseResult.boundary || null,
        wall_segments: parseResult.wall_segments || [],
        method: parseResult.method || 'unknown',
        image_width: imgW,
        image_height: imgH,
      };
    }

    if (await useDb()) {
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
      parse_result: {
        ...parseResult,
        scale_px_per_inch: roomUpdates.scale_px_per_inch || null,
      },
    });
  } catch (err) {
    console.error('Floor plan upload error:', err.message);
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

  if (await useDb()) {
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
