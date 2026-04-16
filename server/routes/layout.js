import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase.js';
import { buildLayoutJSON } from '../services/exportFormats.js';
import { chat } from '../services/llmRouter.js';
import * as fallback from '../services/fallbackStore.js';

const router = express.Router();

async function useDb() {
  return fallback.checkDbAvailable(supabaseAdmin);
}

// POST /api/layout/auto-place — Use LLM to compute optimal placement for all furniture
router.post('/auto-place', requireAuth, async (req, res) => {
  const { room_id } = req.body;
  const db = await useDb();

  try {
    let room, placements;
    if (db) {
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
    
    // Parse the LLM response
    let arrangements;
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response.text.trim();
      const jsonMatch = jsonStr.match(/\[[\s\S]*?\]/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      arrangements = JSON.parse(jsonStr);
    } catch (parseErr) {
      return res.status(500).json({ error: 'Failed to parse AI layout response', raw: response.text });
    }

    // Build candidates with effective dimensions and clamp within room bounds
    const effDims = (p, rotation) => {
      const swapped = rotation === 90 || rotation === 270;
      return { effW: swapped ? p.depth : p.width, effD: swapped ? p.width : p.depth };
    };
    const candidates = arrangements.map(arr => {
      const placement = placements.find(p => p.id === arr.id);
      if (!placement) return null;
      const rotation = [0, 90, 180, 270].includes(arr.rotation) ? arr.rotation : 0;
      const { effW, effD } = effDims(placement, rotation);
      const x = Math.max(0, Math.min(Math.round(arr.x_inches || 0), roomW - effW));
      const y = Math.max(0, Math.min(Math.round(arr.y_inches || 0), roomD - effD));
      return { placement, rotation, x, y, effW, effD };
    }).filter(Boolean);

    // Overlap resolver: greedy placement with spiral nudge
    const boxOverlaps = (a, b) => !(a.x + a.effW <= b.x || b.x + b.effW <= a.x || a.y + a.effD <= b.y || b.y + b.effD <= a.y);
    const gridStep = 6;
    const placed = [];

    for (const c of candidates) {
      let bestX = c.x, bestY = c.y, found = false;
      const tryPlace = (tx, ty) => {
        if (tx < 0 || ty < 0 || tx + c.effW > roomW || ty + c.effD > roomD) return false;
        const test = { x: tx, y: ty, effW: c.effW, effD: c.effD };
        return !placed.some(o => boxOverlaps(test, o));
      };

      if (tryPlace(c.x, c.y)) {
        found = true;
      } else {
        // Spiral outward to find nearest non-overlapping position
        outer: for (let r = gridStep; r <= Math.max(roomW, roomD); r += gridStep) {
          for (let dx = -r; dx <= r; dx += gridStep) {
            for (let dy = -r; dy <= r; dy += gridStep) {
              if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
              const tx = Math.round((c.x + dx) / gridStep) * gridStep;
              const ty = Math.round((c.y + dy) / gridStep) * gridStep;
              if (tryPlace(tx, ty)) { bestX = tx; bestY = ty; found = true; break outer; }
            }
          }
        }
      }

      // Last resort: linear scan for any valid position in the room
      if (!found) {
        for (let tx = 0; tx + c.effW <= roomW; tx += gridStep) {
          for (let ty = 0; ty + c.effD <= roomD; ty += gridStep) {
            if (tryPlace(tx, ty)) { bestX = tx; bestY = ty; found = true; break; }
          }
          if (found) break;
        }
      }

      placed.push({ x: bestX, y: bestY, effW: c.effW, effD: c.effD, placement: c.placement, rotation: c.rotation });
    }

    // Save resolved positions
    const updates = [];
    for (const c of placed) {
      if (db) {
        await supabaseAdmin.from('placements')
          .update({ x_inches: c.x, y_inches: c.y, rotation: c.rotation, updated_at: new Date().toISOString() })
          .eq('id', c.placement.id);
      } else {
        fallback.updatePlacement(c.placement.id, { x_inches: c.x, y_inches: c.y, rotation: c.rotation });
      }
      updates.push({ id: c.placement.id, name: c.placement.name, x_inches: c.x, y_inches: c.y, rotation: c.rotation });
    }

    res.json({ message: `Auto-placed ${updates.length} items.`, placements: updates });
  } catch (err) {
    console.error('Auto-place error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/layout/generate — AI-powered layout generation
router.post('/generate', requireAuth, async (req, res) => {
  const { room_id } = req.body;
  // Redirect to auto-place
  req.body.room_id = room_id;
  res.json({
    message: 'Use POST /api/layout/auto-place for AI layout generation.',
    placements: [],
  });
});

// POST /api/layout/validate — validate current layout
router.post('/validate', requireAuth, async (req, res) => {
  const { room_id } = req.body;
  let room, placements;

  if (await useDb()) {
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

  const errors = [];
  const getEffectiveDims = (p) => {
    if (p.rotation === 90 || p.rotation === 270) {
      return { w: p.depth, d: p.width };
    }
    return { w: p.width, d: p.depth };
  };

  for (let i = 0; i < placements.length; i++) {
    const a = placements[i];
    const ad = getEffectiveDims(a);
    // Check bounds
    if (room.width && (a.x_inches + ad.w > room.width)) {
      errors.push(`${a.name} extends beyond room width`);
    }
    if (room.depth && (a.y_inches + ad.d > room.depth)) {
      errors.push(`${a.name} extends beyond room depth`);
    }
    // Check overlaps
    for (let j = i + 1; j < placements.length; j++) {
      const b = placements[j];
      const bd = getEffectiveDims(b);
      const ax2 = a.x_inches + ad.w, ay2 = a.y_inches + ad.d;
      const bx2 = b.x_inches + bd.w, by2 = b.y_inches + bd.d;
      if (!(ax2 <= b.x_inches || bx2 <= a.x_inches || ay2 <= b.y_inches || by2 <= a.y_inches)) {
        errors.push(`${a.name} overlaps with ${b.name}`);
      }
    }
  }

  res.json({ valid: errors.length === 0, errors });
});

export default router;
