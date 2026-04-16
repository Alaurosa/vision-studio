import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase.js';
import { chat } from '../services/llmRouter.js';
import * as fallback from '../services/fallbackStore.js';

const router = express.Router();

async function useDb() {
  return fallback.checkDbAvailable(supabaseAdmin);
}

const LAYOUT_FUNCTIONS = [
  {
    name: 'move_furniture',
    description: 'Move a furniture item to a new (x, y) position in the room (in inches from top-left corner). Use this when the user asks to move, reposition, or place an item at a specific location (e.g. "against the wall", "in the corner", "centered").',
    parameters: {
      type: 'object',
      properties: {
        furniture_name: { type: 'string', description: 'Name of the furniture item to move (partial match OK)' },
        x_inches: { type: 'number', description: 'New X position in inches from left wall' },
        y_inches: { type: 'number', description: 'New Y position in inches from top wall' },
      },
      required: ['furniture_name', 'x_inches', 'y_inches'],
    },
  },
  {
    name: 'rotate_furniture',
    description: 'Rotate a furniture item to a specific angle. Use when user says "turn", "rotate", "face the other way", etc.',
    parameters: {
      type: 'object',
      properties: {
        furniture_name: { type: 'string' },
        rotation: { type: 'number', enum: [0, 90, 180, 270], description: '0=facing down, 90=facing left, 180=facing up, 270=facing right' },
      },
      required: ['furniture_name', 'rotation'],
    },
  },
  {
    name: 'suggest_furniture',
    description: 'Search the catalog for furniture that fits the user needs. Use when user asks about what furniture to add or wants recommendations.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Furniture category: sofa, bed, desk, bookshelf, dining_table, coffee_table, dresser, nightstand, armchair, tv_stand' },
        max_width_inches: { type: 'number' },
        max_depth_inches: { type: 'number' },
        provider: { type: 'string', enum: ['ikea', 'ashley', 'any'] },
        style_hint: { type: 'string' },
      },
      required: ['category'],
    },
  },
  {
    name: 'add_furniture',
    description: 'Add a specific furniture item from the catalog to the room at a given position. Use when user wants to add furniture. You MUST compute a good (x, y) position that avoids overlaps.',
    parameters: {
      type: 'object',
      properties: {
        catalog_item_name: { type: 'string', description: 'Full or partial name of the catalog item to add' },
        x_inches: { type: 'number', description: 'X position to place the item' },
        y_inches: { type: 'number', description: 'Y position to place the item' },
        rotation: { type: 'number', enum: [0, 90, 180, 270], description: 'Initial rotation angle' },
      },
      required: ['catalog_item_name'],
    },
  },
  {
    name: 'remove_furniture',
    description: 'Remove a furniture item from the room. Use when user says "remove", "delete", "get rid of", etc.',
    parameters: {
      type: 'object',
      properties: { furniture_name: { type: 'string' } },
      required: ['furniture_name'],
    },
  },
  {
    name: 'validate_layout',
    description: 'Check all furniture placements for overlaps, out-of-bounds, and walkway clearance issues. Use when user asks to check the layout or after making multiple changes.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'arrange_room',
    description: 'Automatically rearrange ALL furniture in the room using AI to find the optimal layout. Call this when the user asks you to "arrange", "organize", "layout", "redesign", or "optimize" the entire room. Also use when user says things like "make it look nice" or "fix the layout".',
    parameters: {
      type: 'object',
      properties: {
        style: { type: 'string', description: 'Optional arrangement style: "open", "cozy", "functional", "minimal", "social"' },
      },
    },
  },
  {
    name: 'swap_furniture',
    description: 'Replace one furniture item in the room with a different item from the catalog. The new item will be placed at the same position. Use when user says "replace", "swap", "switch", or "change to".',
    parameters: {
      type: 'object',
      properties: {
        current_furniture_name: { type: 'string', description: 'Name of the furniture item to replace' },
        new_catalog_item_name: { type: 'string', description: 'Name of the new item from catalog' },
      },
      required: ['current_furniture_name', 'new_catalog_item_name'],
    },
  },
  {
    name: 'furnish_room',
    description: 'Autonomously select and place a complete set of furniture for a room type, then arrange everything optimally. Use when the user asks to "furnish the room", "fill the room", "add furniture for a living room", "set up a bedroom", "recommend and arrange furniture", or gives a compound request like "recommend me furniture and arrange it". This is the all-in-one tool that picks furniture, adds it, AND arranges it.',
    parameters: {
      type: 'object',
      properties: {
        room_type: { type: 'string', description: 'Type of room: living_room, bedroom, office, dining_room, studio', enum: ['living_room', 'bedroom', 'office', 'dining_room', 'studio'] },
        style: { type: 'string', description: 'Optional style: modern, cozy, minimal, functional', enum: ['modern', 'cozy', 'minimal', 'functional'] },
        budget: { type: 'string', description: 'Optional budget tier: budget, mid, premium', enum: ['budget', 'mid', 'premium'] },
        provider: { type: 'string', description: 'Preferred provider: ikea, ashley, any', enum: ['ikea', 'ashley', 'any'] },
      },
      required: ['room_type'],
    },
  },
];

async function executeFunction(fnName, args, roomId, placements, room, db) {
  switch (fnName) {
    case 'move_furniture': {
      const p = placements.find((p) => p.name?.toLowerCase().includes(args.furniture_name.toLowerCase()));
      if (!p) return { success: false, message: `Furniture "${args.furniture_name}" not found` };
      if (db) {
        await supabaseAdmin
          .from('placements')
          .update({ x_inches: args.x_inches, y_inches: args.y_inches, updated_at: new Date().toISOString() })
          .eq('id', p.id);
      } else {
        fallback.updatePlacement(p.id, { x_inches: args.x_inches, y_inches: args.y_inches });
      }
      return { success: true, message: `Moved ${p.name} to (${args.x_inches}", ${args.y_inches}")` };
    }
    case 'rotate_furniture': {
      const p = placements.find((p) => p.name?.toLowerCase().includes(args.furniture_name.toLowerCase()));
      if (!p) return { success: false, message: `Furniture "${args.furniture_name}" not found` };
      if (db) {
        await supabaseAdmin.from('placements').update({ rotation: args.rotation }).eq('id', p.id);
      } else {
        fallback.updatePlacement(p.id, { rotation: args.rotation });
      }
      return { success: true, message: `Rotated ${p.name} to ${args.rotation}°` };
    }
    case 'suggest_furniture': {
      let data;
      if (db) {
        let q = supabaseAdmin.from('furniture_catalog').select('*');
        if (args.category) q = q.eq('category', args.category);
        if (args.provider && args.provider !== 'any') q = q.eq('provider', args.provider);
        if (args.max_width_inches) q = q.lte('width', args.max_width_inches);
        if (args.max_depth_inches) q = q.lte('depth', args.max_depth_inches);
        const res = await q.limit(5);
        data = res.data;
      } else {
        const result = fallback.getCatalog({ category: args.category, provider: args.provider === 'any' ? undefined : args.provider, limit: 5 });
        data = result.items;
      }
      return { success: true, suggestions: data };
    }
    case 'add_furniture': {
      let item;
      if (db) {
        const { data: matches } = await supabaseAdmin
          .from('furniture_catalog')
          .select('*')
          .ilike('name', `%${args.catalog_item_name}%`)
          .limit(1);
        item = matches?.[0];
      } else {
        const matches = fallback.searchCatalogByName(args.catalog_item_name);
        item = matches[0];
      }
      if (!item) return { success: false, message: `"${args.catalog_item_name}" not found in catalog` };

      const placement = {
        room_id: roomId,
        catalog_id: item.id,
        name: item.name,
        category: item.category,
        provider: item.provider,
        width: item.width,
        depth: item.depth,
        height: item.height,
        x_inches: args.x_inches || 12,
        y_inches: args.y_inches || 12,
        rotation: args.rotation || 0,
        color: '#d4a27a',
      };
      if (db) {
        await supabaseAdmin.from('placements').insert(placement);
      } else {
        fallback.addPlacement(placement);
      }
      return { success: true, message: `Added ${item.name} to the room` };
    }
    case 'remove_furniture': {
      const p = placements.find((p) => p.name?.toLowerCase().includes(args.furniture_name.toLowerCase()));
      if (!p) return { success: false, message: `Furniture "${args.furniture_name}" not found` };
      if (db) {
        await supabaseAdmin.from('placements').delete().eq('id', p.id);
      } else {
        fallback.deletePlacement(p.id);
      }
      return { success: true, message: `Removed ${p.name} from the room` };
    }
    case 'validate_layout': {
      const errors = [];
      // Account for rotation when computing bounding boxes
      const getEffectiveDims = (p) => {
        if (p.rotation === 90 || p.rotation === 270) {
          return { w: p.depth, d: p.width };
        }
        return { w: p.width, d: p.depth };
      };
      for (let i = 0; i < placements.length; i++) {
        for (let j = i + 1; j < placements.length; j++) {
          const a = placements[i], b = placements[j];
          const ad = getEffectiveDims(a), bd = getEffectiveDims(b);
          const ax2 = a.x_inches + ad.w, ay2 = a.y_inches + ad.d;
          const bx2 = b.x_inches + bd.w, by2 = b.y_inches + bd.d;
          if (!(ax2 <= b.x_inches || bx2 <= a.x_inches || ay2 <= b.y_inches || by2 <= a.y_inches)) {
            errors.push(`${a.name} overlaps with ${b.name}`);
          }
        }
      }
      // Check room bounds
      if (room?.width && room?.depth) {
        for (const p of placements) {
          const pd = getEffectiveDims(p);
          if (p.x_inches < 0 || p.y_inches < 0 || p.x_inches + pd.w > room.width || p.y_inches + pd.d > room.depth) {
            errors.push(`${p.name} extends outside the room`);
          }
        }
      }
      return { success: true, valid: errors.length === 0, errors };
    }
    case 'arrange_room': {
      if (placements.length === 0) return { success: false, message: 'No furniture to arrange' };
      if (!room?.width || !room?.depth) return { success: false, message: 'Room dimensions not set' };

      // Use LLM to compute optimal positions for all items — with explicit chain-of-thought reasoning
      const arrangePrompt = `You are a senior interior designer. Produce an optimal furniture arrangement for this room.

ROOM: ${room.width}" wide (x-axis) × ${room.depth}" deep (y-axis)${args.style ? `   STYLE: ${args.style}` : ''}

COORDINATE SYSTEM:
- (x=0, y=0) is the top-left corner
- x increases to the right (max x = ${room.width})
- y increases downward (max y = ${room.depth})
- A piece at (x, y) occupies [x, x+W] × [y, y+D] where W,D = effective width/depth after rotation
- rotation=0: item's back/headboard at LOW y, front faces toward HIGH y (downward)
- rotation=90: back at HIGH x, front faces LOW x (left); W and D are swapped
- rotation=180: back at HIGH y, front faces LOW y (upward)
- rotation=270: back at LOW x, front faces HIGH x (right); W and D are swapped

FURNITURE TO PLACE:
${placements.map((p, i) => `  ${i}: "${p.name}" (${p.category}) — ${p.width}"W × ${p.depth}"D`).join('\n')}

REASONING STEPS (do these in order silently, then output the JSON):
1. Identify the focal point of the room. Priority: TV > fireplace > window > bed. If there is a TV/tv_stand, it is the focal point for the living area. If there is a bed, it is the focal point for the sleeping area.
2. Place the focal point FIRST, against a wall. TV stands/bookshelves/bed headboards touch a wall (the item's back edge at y=0, y=room depth, x=0, or x=room width).
3. Orient the sofa/armchair to FACE the focal point. A sofa faces the TV — this means the sofa's FRONT (not back) must point toward the TV. If TV is on the north wall (y=0), the sofa's back must be closer to the south wall, and rotation=180 so it faces up toward the TV.
4. Place secondary pieces relative to the focal group:
   - coffee_table: 18" in front of the sofa (between sofa and TV)
   - nightstand: immediately beside the bed (left or right, touching the bed's long side)
   - armchair: angled at ~45° or perpendicular to the sofa facing the focal point — snap to nearest of 0/90/180/270
   - dresser: against a wall not used by the bed
   - desk: against a wall, with rotation so the user faces the wall (back of chair is toward the room)
   - bookshelf: against a wall, low priority for the main wall
   - dining_table: in an open area, not against any wall
5. Verify constraints:
   - NO two items overlap in their [x, x+effW] × [y, y+effD] rectangles
   - Every item satisfies 0 <= x, 0 <= y, x + effW <= ${room.width}, y + effD <= ${room.depth}
   - Leave at least one 24"-wide walkway connecting the room's entry area to each major zone
   - Beds/bookshelves/dressers/tv_stands can have their back touching a wall; sofas should be 2-6" off the wall; free-standing items need 18"+ clearance

OUTPUT: Return ONLY a JSON array, no prose. Each entry must include index, x, y, rotation, and a short "reason" field explaining the choice.
Format: [{"index": 0, "x": 12, "y": 4, "rotation": 180, "reason": "sofa faces TV on north wall"}, ...]`;

      try {
        const arrangeRes = await chat({
          messages: [{ role: 'user', content: arrangePrompt }],
          systemPrompt: 'You are a spatial layout optimizer. Reason step by step internally, then return only valid JSON matching the requested schema.',
        });

        let positions;
        const jsonMatch = arrangeRes.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) positions = JSON.parse(jsonMatch[0]);
        else positions = JSON.parse(arrangeRes.text);

        // Build candidate placements (index → {p, rotation, x, y, effW, effD})
        const effDims = (p, rotation) => {
          const eff = (rotation === 90 || rotation === 270);
          return { effW: eff ? p.depth : p.width, effD: eff ? p.width : p.depth };
        };
        const candidates = positions.map((pos) => {
          const p = placements[pos.index];
          if (!p) return null;
          const rotation = [0, 90, 180, 270].includes(pos.rotation) ? pos.rotation : 0;
          const { effW, effD } = effDims(p, rotation);
          const x = Math.max(0, Math.min(Number(pos.x) || 0, room.width - effW));
          const y = Math.max(0, Math.min(Number(pos.y) || 0, room.depth - effD));
          return { p, rotation, x, y, effW, effD };
        }).filter(Boolean);

        // Overlap resolver: greedy nudge on grid until no overlaps with earlier-placed items
        const overlaps = (a, b) => !(a.x + a.effW <= b.x || b.x + b.effW <= a.x || a.y + a.effD <= b.y || b.y + b.effD <= a.y);
        const gridStep = 6;
        const placed = [];
        for (const c of candidates) {
          let bestX = c.x, bestY = c.y, found = false;
          const tryPlace = (tx, ty) => {
            if (tx < 0 || ty < 0 || tx + c.effW > room.width || ty + c.effD > room.depth) return false;
            const test = { ...c, x: tx, y: ty };
            return !placed.some((o) => overlaps(test, o));
          };
          if (tryPlace(c.x, c.y)) { found = true; }
          else {
            // Spiral outward on the grid to find nearest free spot
            outer: for (let r = gridStep; r <= Math.max(room.width, room.depth); r += gridStep) {
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
            for (let tx = 0; tx + c.effW <= room.width; tx += gridStep) {
              for (let ty = 0; ty + c.effD <= room.depth; ty += gridStep) {
                if (tryPlace(tx, ty)) { bestX = tx; bestY = ty; found = true; break; }
              }
              if (found) break;
            }
          }

          placed.push({ ...c, x: bestX, y: bestY, resolved: !found });
        }

        let moved = 0;
        for (const c of placed) {
          if (db) {
            await supabaseAdmin.from('placements').update({ x_inches: c.x, y_inches: c.y, rotation: c.rotation, updated_at: new Date().toISOString() }).eq('id', c.p.id);
          } else {
            fallback.updatePlacement(c.p.id, { x_inches: c.x, y_inches: c.y, rotation: c.rotation });
          }
          moved++;
        }
        return { success: true, message: `Arranged ${moved} items${args.style ? ` in ${args.style} style` : ''}`, refresh: true };
      } catch (err) {
        return { success: false, message: `Arrangement failed: ${err.message}` };
      }
    }
    case 'swap_furniture': {
      const current = placements.find(p => p.name?.toLowerCase().includes(args.current_furniture_name.toLowerCase()));
      if (!current) return { success: false, message: `"${args.current_furniture_name}" not found in room` };

      let newItem;
      if (db) {
        const { data: matches } = await supabaseAdmin
          .from('furniture_catalog')
          .select('*')
          .ilike('name', `%${args.new_catalog_item_name}%`)
          .limit(1);
        newItem = matches?.[0];
      } else {
        const matches = fallback.searchCatalogByName(args.new_catalog_item_name);
        newItem = matches[0];
      }
      if (!newItem) return { success: false, message: `"${args.new_catalog_item_name}" not found in catalog` };

      // Remove old, add new at same position
      const pos = { x_inches: current.x_inches, y_inches: current.y_inches, rotation: current.rotation };
      if (db) {
        await supabaseAdmin.from('placements').delete().eq('id', current.id);
        await supabaseAdmin.from('placements').insert({
          room_id: roomId, catalog_id: newItem.id, name: newItem.name, category: newItem.category,
          provider: newItem.provider, width: newItem.width, depth: newItem.depth, height: newItem.height,
          x_inches: pos.x_inches, y_inches: pos.y_inches, rotation: pos.rotation, color: '#d4a27a',
        });
      } else {
        fallback.deletePlacement(current.id);
        fallback.addPlacement({
          room_id: roomId, catalog_id: newItem.id, name: newItem.name, category: newItem.category,
          provider: newItem.provider, width: newItem.width, depth: newItem.depth, height: newItem.height,
          x_inches: pos.x_inches, y_inches: pos.y_inches, rotation: pos.rotation, color: '#d4a27a',
        });
      }
      return { success: true, message: `Replaced ${current.name} with ${newItem.name}`, refresh: true };
    }
    case 'furnish_room': {
      if (!room?.width || !room?.depth) return { success: false, message: 'Room dimensions not set — upload a floor plan or set dimensions first' };

      // Define furniture sets by room type
      const ROOM_PRESETS = {
        living_room: ['sofa', 'coffee_table', 'tv_stand', 'armchair', 'bookshelf'],
        bedroom: ['bed', 'nightstand', 'nightstand', 'dresser', 'bookshelf'],
        office: ['desk', 'bookshelf', 'armchair'],
        dining_room: ['dining_table', 'bookshelf'],
        studio: ['bed', 'desk', 'sofa', 'coffee_table', 'bookshelf'],
      };

      const categories = ROOM_PRESETS[args.room_type] || ROOM_PRESETS.living_room;
      const provider = (args.provider && args.provider !== 'any') ? args.provider : undefined;
      const budgetSort = args.budget === 'budget' ? 'asc' : args.budget === 'premium' ? 'desc' : undefined;

      // Select one item per category from catalog
      const selectedItems = [];
      for (const cat of categories) {
        let items;
        if (db) {
          let q = supabaseAdmin.from('furniture_catalog').select('*').eq('category', cat).eq('available', true);
          if (provider) q = q.eq('provider', provider);
          if (budgetSort) q = q.order('price_usd', { ascending: budgetSort === 'asc' });
          const { data } = await q.limit(5);
          items = data || [];
        } else {
          const result = fallback.getCatalog({ category: cat, provider, limit: 5 });
          items = result.items || [];
        }
        if (items.length === 0) continue;

        // Pick the first item (cheapest if budget, most expensive if premium, first otherwise)
        const pick = items[0];

        // Check if the item fits in the room at all
        if (pick.width > room.width || pick.depth > room.depth) {
          // Try rotated
          if (pick.depth <= room.width && pick.width <= room.depth) {
            selectedItems.push({ ...pick, _rotation: 90 });
          }
          continue; // Skip items that don't fit at all
        }
        selectedItems.push(pick);
      }

      if (selectedItems.length === 0) {
        return { success: false, message: 'No suitable furniture found in the catalog for this room type' };
      }

      // Add all selected items to the room
      const added = [];
      for (const item of selectedItems) {
        const placement = {
          room_id: roomId,
          catalog_id: item.id,
          name: item.name,
          category: item.category,
          provider: item.provider,
          width: item.width,
          depth: item.depth,
          height: item.height,
          x_inches: 12,
          y_inches: 12,
          rotation: item._rotation || 0,
          color: '#d4a27a',
        };
        if (db) {
          const { data: newP } = await supabaseAdmin.from('placements').insert(placement).select().single();
          if (newP) added.push(newP);
        } else {
          const newP = fallback.addPlacement(placement);
          added.push(newP);
        }
      }

      // Now arrange everything — re-fetch current placements
      let allPlacements;
      if (db) {
        const { data } = await supabaseAdmin.from('placements').select('*').eq('room_id', roomId);
        allPlacements = data || [];
      } else {
        const updatedRoom = fallback.getRoom(roomId, '');
        allPlacements = updatedRoom?.placements || [];
      }

      // Run the arrange_room logic on all placements
      const arrangeResult = await executeFunction('arrange_room', { style: args.style || 'functional' }, roomId, allPlacements, room, db);

      const totalCost = selectedItems.reduce((sum, it) => sum + (it.price_usd || 0), 0);
      const itemNames = selectedItems.map(it => it.name).join(', ');

      return {
        success: true,
        message: `Furnished ${args.room_type.replace('_', ' ')} with ${selectedItems.length} items: ${itemNames}. Total estimated cost: $${totalCost.toFixed(0)}. ${arrangeResult.success ? 'Arranged optimally.' : ''}`,
        refresh: true,
        suggestions: selectedItems,
      };
    }
    default:
      return { success: false, message: `Unknown function: ${fnName}` };
  }
}

// POST /api/chat/message
router.post('/message', requireAuth, async (req, res) => {
  const { room_id, message } = req.body;
  const db = await useDb();

  try {
    let room, placements, history;

    if (db) {
      const [roomRes, placementsRes, historyRes] = await Promise.all([
        supabaseAdmin.from('rooms').select('*').eq('id', room_id).eq('user_id', req.user.id).single(),
        supabaseAdmin.from('placements').select('*').eq('room_id', room_id),
        supabaseAdmin
          .from('chat_messages')
          .select('*')
          .eq('room_id', room_id)
          .order('created_at')
          .limit(20),
      ]);
      room = roomRes.data;
      placements = placementsRes.data || [];
      history = historyRes.data || [];
    } else {
      room = fallback.getRoom(room_id, req.user.id);
      placements = room?.placements || [];
      history = fallback.getChatHistory(room_id);
    }

    if (!room) return res.status(404).json({ error: 'Room not found' });

    const systemPrompt = `You are an expert AI interior design agent for Vision Studio. You don't just answer questions — you take action by calling tools. You can chain multiple actions autonomously to fulfill complex requests.

CAPABILITIES:
- Move, rotate, add, remove, and swap furniture in the room
- Arrange the entire room layout automatically (arrange_room)
- Search the IKEA and Ashley Furniture catalogs (suggest_furniture)
- Validate layouts for overlaps and clearance issues (validate_layout)
- Furnish an entire room end-to-end: select + place + arrange (furnish_room)

ROOM CONTEXT:
- Room: ${room?.name || 'Unnamed'} — ${room?.width || '?'}" wide × ${room?.depth || '?'}" deep × ${room?.height || 96}" tall
- Unit system: ${room?.unit || 'inches'}
- Current furniture (${placements.length} items):
${placements.length > 0 ? placements.map((p) => `  • ${p.name} (${p.category}) — ${p.width}"W × ${p.depth}"D at (${p.x_inches}", ${p.y_inches}"), rotation ${p.rotation}°`).join('\n') : '  (empty room)'}

AUTONOMOUS MULTI-STEP BEHAVIOR:
You can call tools in MULTIPLE ROUNDS. After each round of tool calls, you will see the results and can decide to call MORE tools.
This lets you handle complex requests like:
- "Recommend furniture for a living room and arrange it comfortably" → call furnish_room with room_type=living_room
- "Add a sofa, coffee table, and TV stand, then arrange everything" → call add_furniture three times, then call arrange_room
- "What sofas do you have? Add the cheapest one and put it against the wall" → call suggest_furniture, then in the next round call add_furniture + move_furniture
- "Replace the desk with something smaller and rearrange" → call swap_furniture, then call arrange_room

CRITICAL TOOL-CALLING RULES:
1. For compound requests ("recommend AND arrange", "furnish the room", "set up a living room"), prefer calling furnish_room — it handles selection, placement, and arrangement in one step.
2. RECOMMENDATIONS → ALWAYS call suggest_furniture, never just describe items in text.
3. PLACE / ADD → ALWAYS call add_furniture with computed non-overlapping (x, y) coordinates.
4. ARRANGE → call arrange_room. When asked to organize, arrange, redesign, optimize, or "make it look nice".
5. You can call MULTIPLE tools in a single response (parallel calls). You can also make SEQUENTIAL rounds — after seeing results from round 1, you can call more tools in round 2.
6. Always compute valid (x, y) that respects room bounds and avoids overlap with existing furniture.
7. After ALL tool rounds are done, write a concise summary (1-3 sentences) of everything you did.

COORDINATE SYSTEM:
- x=0 is the left wall, x=room width is the right wall
- y=0 is the top wall, y=room depth is the bottom wall
- rotation 0 = furniture faces +y (downward on plan). For a sofa, the back is at low y and the seat opens toward high y.
- rotation 90 = faces +x (right).  rotation 180 = faces -y (up).  rotation 270 = faces -x (left).

Be concise and action-oriented. No lengthy preambles.`;

    const llmMessages = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    // Save user message
    if (db) {
      await supabaseAdmin.from('chat_messages').insert({ room_id, role: 'user', content: message });
    } else {
      fallback.addChatMessage(room_id, { role: 'user', content: message });
    }

    // --- Multi-turn tool execution loop ---
    // The LLM can call tools, see results, and call MORE tools over multiple rounds.
    // This enables autonomous multi-step workflows like "recommend + add + arrange".
    const MAX_TOOL_ROUNDS = 5;
    const allActions = [];
    let finalText = '';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await chat({ messages: llmMessages, systemPrompt, tools: LAYOUT_FUNCTIONS });

      // If no tool calls, this is the final text response
      if (!response.tool_calls || response.tool_calls.length === 0) {
        finalText = response.text;
        break;
      }

      // Add the assistant's message (with tool_calls) to the conversation
      llmMessages.push(response.raw_message);

      // Execute each tool call and feed results back to the LLM
      for (const toolCall of response.tool_calls) {
        let fnName, args, result;
        try {
          fnName = toolCall.function?.name;
          args = JSON.parse(toolCall.function?.arguments || '{}');

          // Re-fetch placements before each tool execution so we see the latest state
          if (db) {
            const { data } = await supabaseAdmin.from('placements').select('*').eq('room_id', room_id);
            placements = data || [];
          } else {
            const updatedRoom = fallback.getRoom(room_id, req.user.id);
            placements = updatedRoom?.placements || [];
          }

          result = await executeFunction(fnName, args, room_id, placements, room, db);
        } catch (parseErr) {
          fnName = toolCall.function?.name;
          args = {};
          result = { success: false, message: 'Failed to parse function arguments' };
        }

        allActions.push({ function: fnName, args, result });

        // Feed the tool result back to the LLM as a tool message
        llmMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // If this was the last allowed round, get a final text response without tools
      if (round === MAX_TOOL_ROUNDS - 1) {
        const finalResponse = await chat({ messages: llmMessages, systemPrompt });
        finalText = finalResponse.text;
      }
      // Otherwise, loop back — the LLM sees the tool results and can call more tools or produce text
    }

    // If we never got final text (loop exhausted), generate a summary
    if (!finalText && allActions.length > 0) {
      const summaryRes = await chat({
        messages: [...llmMessages, { role: 'user', content: 'Summarize everything you just did in 1-2 sentences.' }],
        systemPrompt,
      });
      finalText = summaryRes.text;
    }

    // Save assistant response
    if (db) {
      await supabaseAdmin.from('chat_messages').insert({
        room_id,
        role: 'assistant',
        content: finalText,
        tool_calls: allActions.length > 0 ? allActions : null,
      });
    } else {
      fallback.addChatMessage(room_id, {
        role: 'assistant',
        content: finalText,
        tool_calls: allActions.length > 0 ? allActions : null,
      });
    }

    res.json({ message: finalText, actions: allActions, refresh: allActions.some(a => a.result?.refresh) });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
