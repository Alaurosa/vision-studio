import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { useDb, supabaseAdmin, fallback } from '../services/db.js';
import { buildLayoutJSON } from '../services/exportFormats.js';
import { chat } from '../services/llmRouter.js';
import { log } from '../services/logger.js';
import { resolveOverlaps, getEffectiveDims, validateLayout } from '../services/overlapResolver.js';

const router = express.Router();

// POST /api/layout/auto-place — Use LLM to compute optimal placement for all furniture
router.post('/auto-place', optionalAuth, async (req, res) => {
  const { room_id, room_context, placements_context } = req.body;
  const db = await useDb();
  const isDraft = typeof room_id === 'string' && room_id.startsWith('draft-');

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
      room = fallback.getRoom(room_id, req.user.id);
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
  } else if (await useDb()) {
    const [roomRes, placementsRes] = await Promise.all([
      supabaseAdmin.from('rooms').select('*').eq('id', room_id).eq('user_id', req.user.id).single(),
      supabaseAdmin.from('placements').select('*').eq('room_id', room_id),
    ]);
    if (roomRes.error) return res.status(404).json({ error: 'Room not found' });
    room = roomRes.data;
    placements = placementsRes.data || [];
  } else {
    room = fallback.getRoom(room_id, req.user.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    placements = room.placements || [];
  }

  res.json(validateLayout(placements, room));
});

export default router;
