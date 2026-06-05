import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { useDb, supabaseAdmin, fallback, hasDbUserId, getFallbackRoom } from '../services/db.js';
import { log } from '../services/logger.js';
import { validateLayout, CLEARANCE_IN } from '../services/overlapResolver.js';
import { autoArrangeFurniture } from '../services/autoArrange.js';
import { buildZoneContext } from '../services/zonePlacement.js';
import {
  generateLayout,
  generateLayoutFromCatalog,
  normalizeRoomType,
  ROOM_LAYOUT_CONSTRAINTS,
} from '../services/layoutGenerator.js';
import * as fallbackStore from '../services/fallbackStore.js';

const router = express.Router();

// GET /api/layout/room-types — constraint definitions for supported room types
router.get('/room-types', (req, res) => {
  const types = Object.entries(ROOM_LAYOUT_CONSTRAINTS).map(([id, def]) => ({
    id,
    label: def.label,
    categories: def.categories,
    rules: def.rules,
  }));
  res.json({ room_types: types });
});

/**
 * POST /api/layout/generate — constraint-based layout (no LLM).
 * Body: { room_type, room: { width, depth }, furniture?: [...] }
 * If furniture omitted, picks catalog items for the room type (demo/DB catalog).
 */
router.post('/generate', optionalAuth, async (req, res) => {
  const { room_type, room, furniture, use_catalog } = req.body;
  const type = normalizeRoomType(room_type);

  if (!room?.width || !room?.depth) {
    return res.status(400).json({ error: 'room.width and room.depth are required (inches)' });
  }

  try {
    let result;
    if (use_catalog !== false && (!furniture || furniture.length === 0)) {
      const db = (await useDb()) && hasDbUserId(req.user?.id);
      if (db) {
        const { data } = await supabaseAdmin.from('furniture_catalog').select('*').eq('available', true).limit(50);
        result = generateLayoutFromCatalog(type, room, () => data || []);
      } else {
        result = generateLayoutFromCatalog(type, room, () => fallbackStore.getCatalog({ limit: 50 }).items);
      }
    } else {
      result = generateLayout({ roomType: type, room, furniture });
    }

    res.json({
      room_type: result.room_type,
      method: result.method,
      placements: result.placements,
      validation: result.validation,
      constraints_applied: result.constraints_applied,
      catalog_items: result.catalog_items?.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        width: i.width,
        depth: i.depth,
      })),
    });
  } catch (err) {
    log.error('Layout generate error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/layout/auto-place — Analyze, constraint-place, then de-overlap (no raw LLM coordinates)
router.post('/auto-place', optionalAuth, async (req, res) => {
  const { room_id, room_context, placements_context, zone_id, zone_context } = req.body;
  const isDraft = typeof room_id === 'string' && room_id.startsWith('draft-');
  const db = (await useDb()) && hasDbUserId(req.user?.id);

  try {
    let room, placements;

    if (isDraft && room_context) {
      room = {
        ...room_context,
        zones: Array.isArray(room_context.zones) ? room_context.zones : [],
      };
      placements = placements_context || [];
    } else if (db) {
      const [roomRes, placementsRes] = await Promise.all([
        supabaseAdmin.from('rooms').select('*').eq('id', room_id).eq('user_id', req.user.id).single(),
        supabaseAdmin.from('placements').select('*').eq('room_id', room_id),
      ]);
      if (roomRes.error) return res.status(404).json({ error: 'Room not found' });
      room = roomRes.data;
      placements = placementsRes.data || [];
    } else {
      room = getFallbackRoom(room_id, req.user.id);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      placements = room.placements || [];
    }

    if (placements.length === 0) {
      return res.json({ message: 'No furniture to arrange.', placements: [], plan: null });
    }

    const zoneContext = buildZoneContext(room, zone_id, zone_context);

    const result = autoArrangeFurniture({ room, placements, zoneContext });

    const updates = [];
    for (const p of result.placements) {
      if (!isDraft) {
        if (db) {
          await supabaseAdmin
            .from('placements')
            .update({
              x_inches: p.x_inches,
              y_inches: p.y_inches,
              rotation: p.rotation,
              updated_at: new Date().toISOString(),
            })
            .eq('id', p.id);
        } else {
          fallback.updatePlacement(p.id, {
            x_inches: p.x_inches,
            y_inches: p.y_inches,
            rotation: p.rotation,
          });
        }
      }
      updates.push({
        id: p.id,
        name: p.name,
        x_inches: p.x_inches,
        y_inches: p.y_inches,
        rotation: p.rotation,
      });
    }

    const summary = result.plan
      ? `Arranged as ${result.plan.room_label} (${result.plan.placement_order.length} items, ${CLEARANCE_IN}" clearance).`
      : `Auto-placed ${updates.length} items.`;

    res.json({
      message: summary,
      method: result.method,
      plan: result.plan,
      validation: result.validation,
      placements: updates,
    });
  } catch (err) {
    log.error('Auto-place error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/layout/validate — validate current layout
router.post('/validate', optionalAuth, async (req, res) => {
  const { room_id, room_context, placements_context } = req.body;
  const isDraftRoom = typeof room_id === 'string' && room_id.startsWith('draft-');
  let room, placements;

  if (isDraftRoom && room_context) {
    room = room_context;
    placements = placements_context || [];
  } else if ((await useDb()) && hasDbUserId(req.user?.id)) {
    const [roomRes, placementsRes] = await Promise.all([
      supabaseAdmin.from('rooms').select('*').eq('id', room_id).eq('user_id', req.user.id).single(),
      supabaseAdmin.from('placements').select('*').eq('room_id', room_id),
    ]);
    if (roomRes.error) return res.status(404).json({ error: 'Room not found' });
    room = roomRes.data;
    placements = placementsRes.data || [];
  } else {
    room = getFallbackRoom(room_id, req.user.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    placements = room.placements || [];
  }

  res.json(validateLayout(placements, room));
});

export default router;
