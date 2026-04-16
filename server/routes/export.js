import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase.js';
import { buildLayoutJSON, buildDXF, buildSVG } from '../services/exportFormats.js';
import * as fallback from '../services/fallbackStore.js';

const router = express.Router();

async function useDb() {
  return fallback.checkDbAvailable(supabaseAdmin);
}

async function getRoomAndPlacements(roomId, userId) {
  if (await useDb()) {
    const [roomRes, placementsRes] = await Promise.all([
      supabaseAdmin.from('rooms').select('*').eq('id', roomId).eq('user_id', userId).single(),
      supabaseAdmin.from('placements').select('*').eq('room_id', roomId),
    ]);
    if (roomRes.error) throw new Error('Room not found');
    return { room: roomRes.data, placements: placementsRes.data || [] };
  }
  const room = fallback.getRoom(roomId, userId);
  if (!room) throw new Error('Room not found');
  const placements = room.placements || [];
  return { room, placements };
}

// POST /api/export/json/:room_id
router.post('/json/:room_id', requireAuth, async (req, res) => {
  try {
    const { room, placements } = await getRoomAndPlacements(req.params.room_id, req.user.id);
    const layout = buildLayoutJSON(room, placements);

    if (await useDb()) {
      await supabaseAdmin.from('layout_exports').insert({ room_id: room.id, layout_json: layout });
    } else {
      fallback.addLayoutExport(room.id, layout);
    }

    const safeName = (room.name || 'room').replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_layout.json"`);
    res.json(layout);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/export/dxf/:room_id
router.post('/dxf/:room_id', requireAuth, async (req, res) => {
  try {
    const { room, placements } = await getRoomAndPlacements(req.params.room_id, req.user.id);
    const dxfString = buildDXF(room, placements);
    const safeName = (room.name || 'room').replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Type', 'application/dxf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.dxf"`);
    res.send(dxfString);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/export/svg/:room_id
router.post('/svg/:room_id', requireAuth, async (req, res) => {
  try {
    const { room, placements } = await getRoomAndPlacements(req.params.room_id, req.user.id);
    const svg = buildSVG(room, placements);
    const safeName = (room.name || 'room').replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.svg"`);
    res.send(svg);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/export/latest/:room_id
router.get('/latest/:room_id', requireAuth, async (req, res) => {
  if (await useDb()) {
    const { data, error } = await supabaseAdmin
      .from('layout_exports')
      .select('*')
      .eq('room_id', req.params.room_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) return res.status(404).json({ error: 'No export found' });
    return res.json(data.layout_json);
  }
  const exp = fallback.getLatestExport(req.params.room_id);
  if (!exp) return res.status(404).json({ error: 'No export found' });
  res.json(exp.layout_json);
});

export default router;
