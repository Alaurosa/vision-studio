import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { useDb, supabaseAdmin, fallback, hasDbUserId, getFallbackRoom } from '../services/db.js';
import { buildLayoutJSON } from '../services/exportFormats.js';
import { chat } from '../services/llmRouter.js';
import { log } from '../services/logger.js';
import { resolveOverlaps, getEffectiveDims, validateLayout } from '../services/overlapResolver.js';
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

// POST /api/layout/auto-place — Use LLM to compute optimal placement for all furniture
router.post('/auto-place', optionalAuth, async (req, res) => {
  const { room_id, room_context, placements_context } = req.body;
  const isDraft = typeof room_id === 'string' && room_id.startsWith('draft-');
  const db = (await useDb()) && hasDbUserId(req.user?.id);

  try {
    let room, placements;

    if (isDraft && room_context) {
      room = room_context;
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
      return res.json({ message: 'No furniture to arrange.', placements: [] });
    }

    const roomW = room.width || 120;
    const roomD = room.depth || 120;

    const systemPrompt = `You are an expert interior designer. Given a room and furniture items, compute the optimal (x, y) position and rotation for each item.

COORDINATE SYSTEM:
- (x=0, y=0) is the top-left corner of the room.
- x increases to the right (max x = ${roomW}).
- y increases downward (max y = ${roomD}).
- The room is ${roomW}" wide (x-axis) × ${roomD}" deep (y-axis).

BOUNDING BOX RULES:
- A piece at (x, y) with rotation 0 or 180 occupies the rectangle [x, x+width] × [y, y+depth].
- A piece at (x, y) with rotation 90 or 270 occupies [x, x+depth] × [y, y+width] (width and depth are swapped).
- HARD CONSTRAINT: For every item, x >= 0, y >= 0, x + effective_width <= ${roomW}, y + effective_depth <= ${roomD}.
- HARD CONSTRAINT: No two items' bounding boxes may overlap. For items A and B, they overlap if NOT (A.right <= B.left OR B.right <= A.left OR A.bottom <= B.top OR B.bottom <= A.top).

PLACEMENT GUIDELINES:
- Keep at least 24" of walkway clearance in main traffic paths.
- Place sofas/seating facing the center or toward a TV if present.
- Place beds with headboard against a wall.
- Place desks near walls with space for a chair.
- Group related items (nightstands beside beds, coffee tables near sofas).

VERIFICATION STEP: Before outputting, verify EVERY pair of items for overlap. If any two items overlap, adjust positions until they don't.

CRITICAL: Respond ONLY with a valid JSON array. No markdown, no explanation, just the JSON.
Each element: {"id": "placement_id", "x_inches": number, "y_inches": number, "rotation": 0|90|180|270}`;

    const furnitureList = placements.map(p => 
      `- ${p.name} (id: ${p.id}): ${p.width}"W × ${p.depth}"D × ${p.height}"H, category: ${p.category}`
    ).join('\n');

    const messages = [{
      role: 'user',
      content: `Room: "${room.name}" — ${room.width || 120}" wide × ${room.depth || 120}" deep

Furniture to place:
${furnitureList}

Compute the optimal position and rotation for each item. Return ONLY a JSON array.`
    }];

    const response = await chat({ messages, systemPrompt });
    
    let arrangements;
    try {
      let jsonStr = response.text.trim();
      const jsonMatch = jsonStr.match(/\[[\s\S]*?\]/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      arrangements = JSON.parse(jsonStr);
    } catch (parseErr) {
      return res.status(500).json({ error: 'Failed to parse AI layout response', raw: response.text });
    }

    // Build candidates with effective dimensions and clamp within room bounds
    const candidates = arrangements.map(arr => {
      const placement = placements.find(p => p.id === arr.id);
      if (!placement) return null;
      const rotation = [0, 90, 180, 270].includes(arr.rotation) ? arr.rotation : 0;
      const { effW, effD } = getEffectiveDims(placement, rotation);
      const x = Math.max(0, Math.min(Math.round(arr.x_inches || 0), roomW - effW));
      const y = Math.max(0, Math.min(Math.round(arr.y_inches || 0), roomD - effD));
      return { placement, rotation, x, y, effW, effD };
    }).filter(Boolean);

    const placed = resolveOverlaps(candidates, roomW, roomD);

    // Save resolved positions (skip DB writes for draft rooms)
    const updates = [];
    for (const c of placed) {
      if (!isDraft) {
        if (db) {
          await supabaseAdmin.from('placements')
            .update({ x_inches: c.x, y_inches: c.y, rotation: c.rotation, updated_at: new Date().toISOString() })
            .eq('id', c.placement.id);
        } else {
          fallback.updatePlacement(c.placement.id, { x_inches: c.x, y_inches: c.y, rotation: c.rotation });
        }
      }
      updates.push({ id: c.placement.id, name: c.placement.name, x_inches: c.x, y_inches: c.y, rotation: c.rotation });
    }

    res.json({ message: `Auto-placed ${updates.length} items.`, placements: updates });
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
