/**
 * Chat tool definitions and execution logic.
 * Extracted from the 675-line chat.js route to improve maintainability.
 */
import { useDb, supabaseAdmin, fallback } from './db.js';
import { chat } from './llmRouter.js';
import { resolveOverlaps, getEffectiveDims, validateLayout } from './overlapResolver.js';

/**
 * OpenAI function-calling tool definitions for the layout assistant.
 */
export const LAYOUT_FUNCTIONS = [
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
  {
    name: 'set_style_preference',
    description: 'Record the user\'s style and aesthetic preferences so all future suggestions match their taste. Call this when the user describes their style (e.g., "I like Scandinavian", "modern and minimal", "warm and cozy"). You can also call this to acknowledge their preferences before making recommendations.',
    parameters: {
      type: 'object',
      properties: {
        style: { type: 'string', description: 'The design style: scandinavian, modern, minimalist, industrial, mid-century, bohemian, rustic, japandi, traditional, coastal' },
        mood: { type: 'string', description: 'The mood/feeling: warm, cool, cozy, airy, dramatic, serene, vibrant, calm' },
        color_palette: { type: 'string', description: 'Preferred color direction: warm neutrals, cool grays, earthy tones, bold colors, monochrome, pastels' },
        budget_preference: { type: 'string', description: 'Budget tier: budget, mid-range, premium', enum: ['budget', 'mid-range', 'premium'] },
        notes: { type: 'string', description: 'Any additional preference notes from the user' },
      },
      required: ['style'],
    },
  },
  {
    name: 'clear_room',
    description: 'Remove ALL furniture from the room at once. Use when the user says "clear everything", "start over", "empty the room", "remove all furniture".',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'estimate_budget',
    description: 'Calculate the total estimated cost of all furniture currently in the room. Use when the user asks "how much does this cost", "what\'s the total", "budget estimate", "price check".',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_room_summary',
    description: 'Get a detailed summary of the current room state including dimensions, furniture count, layout quality, and coverage. Use this to reason about the room before making suggestions, or when the user asks "what\'s in my room", "describe the layout", "room overview".',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'design_advice',
    description: 'Analyze the current layout and provide professional interior design advice. Use when the user asks "what should I change", "any suggestions", "how can I improve this", "design tips", "what\'s missing". This uses AI to evaluate the layout and suggest improvements.',
    parameters: {
      type: 'object',
      properties: {
        focus: { type: 'string', description: 'Optional focus area: flow, balance, lighting, storage, comfort, aesthetics' },
      },
    },
  },
  {
    name: 'compare_items',
    description: 'Compare two catalog items side by side showing dimensions, price, and fit for the room. Use when the user asks "which is better", "compare these", "should I get X or Y".',
    parameters: {
      type: 'object',
      properties: {
        item_a: { type: 'string', description: 'Name of the first item to compare' },
        item_b: { type: 'string', description: 'Name of the second item to compare' },
      },
      required: ['item_a', 'item_b'],
    },
  },
];

/**
 * Execute a single tool-call function against the room state.
 */
export async function executeFunction(fnName, args, roomId, placements, room, db) {
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
      return { success: true, ...validateLayout(placements, room) };
    }
    case 'arrange_room': {
      if (placements.length === 0) return { success: false, message: 'No furniture to arrange' };
      if (!room?.width || !room?.depth) return { success: false, message: 'Room dimensions not set' };

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

        const candidates = positions.map((pos) => {
          const p = placements[pos.index];
          if (!p) return null;
          const rotation = [0, 90, 180, 270].includes(pos.rotation) ? pos.rotation : 0;
          const { effW, effD } = getEffectiveDims(p, rotation);
          const x = Math.max(0, Math.min(Number(pos.x) || 0, room.width - effW));
          const y = Math.max(0, Math.min(Number(pos.y) || 0, room.depth - effD));
          return { placement: p, rotation, x, y, effW, effD };
        }).filter(Boolean);

        const placed = resolveOverlaps(candidates, room.width, room.depth);

        let moved = 0;
        for (const c of placed) {
          if (db) {
            await supabaseAdmin.from('placements').update({ x_inches: c.x, y_inches: c.y, rotation: c.rotation, updated_at: new Date().toISOString() }).eq('id', c.placement.id);
          } else {
            fallback.updatePlacement(c.placement.id, { x_inches: c.x, y_inches: c.y, rotation: c.rotation });
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

        const pick = items[0];
        if (pick.width > room.width || pick.depth > room.depth) {
          if (pick.depth <= room.width && pick.width <= room.depth) {
            selectedItems.push({ ...pick, _rotation: 90 });
          }
          continue;
        }
        selectedItems.push(pick);
      }

      if (selectedItems.length === 0) {
        return { success: false, message: 'No suitable furniture found in the catalog for this room type' };
      }

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

      let allPlacements;
      if (db) {
        const { data } = await supabaseAdmin.from('placements').select('*').eq('room_id', roomId);
        allPlacements = data || [];
      } else {
        allPlacements = fallback.getPlacementsForRoom(roomId);
      }

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
    case 'set_style_preference': {
      const prefs = {
        style: args.style,
        mood: args.mood || null,
        color_palette: args.color_palette || null,
        budget_preference: args.budget_preference || null,
        notes: args.notes || null,
        updated_at: new Date().toISOString(),
      };

      // Persist style preferences in the room metadata
      if (db) {
        const existing = room.style_preferences || {};
        await supabaseAdmin
          .from('rooms')
          .update({ style_preferences: { ...existing, ...prefs } })
          .eq('id', roomId);
      }

      const parts = [`Style: ${args.style}`];
      if (args.mood) parts.push(`Mood: ${args.mood}`);
      if (args.color_palette) parts.push(`Colors: ${args.color_palette}`);
      if (args.budget_preference) parts.push(`Budget: ${args.budget_preference}`);

      return {
        success: true,
        message: `Noted your preferences — ${parts.join(', ')}. I'll keep these in mind for all suggestions.`,
      };
    }
    case 'clear_room': {
      if (placements.length === 0) return { success: true, message: 'Room is already empty.' };
      const count = placements.length;
      for (const p of placements) {
        if (db) {
          await supabaseAdmin.from('placements').delete().eq('id', p.id);
        } else {
          fallback.deletePlacement(p.id);
        }
      }
      return { success: true, message: `Removed all ${count} items from the room.`, refresh: true };
    }
    case 'estimate_budget': {
      if (placements.length === 0) return { success: true, message: 'Room is empty — no cost to estimate.' };
      let total = 0;
      const items = [];
      for (const p of placements) {
        let price = null;
        if (p.catalog_id && db) {
          const { data } = await supabaseAdmin.from('furniture_catalog').select('price_usd').eq('id', p.catalog_id).single();
          price = data?.price_usd;
        }
        if (!price) {
          const matches = fallback.searchCatalogByName(p.name);
          price = matches[0]?.price_usd || null;
        }
        items.push({ name: p.name, price });
        if (price) total += price;
      }
      const breakdown = items.map(i => `• ${i.name}: ${i.price ? '$' + i.price.toFixed(0) : 'price unknown'}`).join('\n');
      return { success: true, message: `Budget estimate:\n${breakdown}\n\nTotal: $${total.toFixed(0)}`, total_usd: total };
    }
    case 'get_room_summary': {
      const roomW = room?.width || 0;
      const roomD = room?.depth || 0;
      const areaFt = (roomW * roomD) / 144;
      let furnitureArea = 0;
      for (const p of placements) {
        const { effW, effD } = getEffectiveDims(p, p.rotation || 0);
        furnitureArea += effW * effD;
      }
      const coveragePct = roomW && roomD ? ((furnitureArea / (roomW * roomD)) * 100).toFixed(1) : 0;
      const validation = validateLayout(placements, room);
      const categories = {};
      for (const p of placements) {
        categories[p.category || 'other'] = (categories[p.category || 'other'] || 0) + 1;
      }
      const catSummary = Object.entries(categories).map(([k, v]) => `${v}× ${k}`).join(', ');
      return {
        success: true,
        summary: {
          room_name: room?.name || 'Unnamed',
          dimensions: `${roomW}" × ${roomD}" (${areaFt.toFixed(0)} sq ft)`,
          furniture_count: placements.length,
          categories: catSummary || 'none',
          floor_coverage: `${coveragePct}%`,
          layout_valid: validation.valid,
          issues: validation.errors,
        },
        message: `Room "${room?.name}": ${roomW}" × ${roomD}" (${areaFt.toFixed(0)} sq ft), ${placements.length} items (${catSummary || 'none'}), ${coveragePct}% floor coverage. ${validation.valid ? 'Layout is valid.' : `Issues: ${validation.errors.join('; ')}`}`,
      };
    }
    case 'design_advice': {
      if (!room?.width || !room?.depth) return { success: false, message: 'Room dimensions not set.' };
      const advicePrompt = `You are a professional interior designer. Analyze this room and give 3-5 specific, actionable suggestions.

Room: "${room.name}" — ${room.width}" wide × ${room.depth}" deep
Current furniture (${placements.length} items):
${placements.length > 0 ? placements.map(p => `  • ${p.name} (${p.category}) at (${p.x_inches}", ${p.y_inches}"), ${p.width}"W × ${p.depth}"D, rotation ${p.rotation}°`).join('\n') : '  (empty)'}
${args.focus ? `Focus area: ${args.focus}` : ''}

Give specific advice about what to add, remove, move, or change. Reference actual furniture positions and names. Be concise — bullet points only.`;

      try {
        const adviceRes = await chat({
          messages: [{ role: 'user', content: advicePrompt }],
          systemPrompt: 'You are a senior interior designer. Give practical, specific advice. Use bullet points. Be concise.',
        });
        return { success: true, message: adviceRes.text };
      } catch (err) {
        return { success: false, message: `Could not generate advice: ${err.message}` };
      }
    }
    case 'compare_items': {
      let itemA, itemB;
      if (db) {
        const { data: a } = await supabaseAdmin.from('furniture_catalog').select('*').ilike('name', `%${args.item_a}%`).limit(1);
        const { data: b } = await supabaseAdmin.from('furniture_catalog').select('*').ilike('name', `%${args.item_b}%`).limit(1);
        itemA = a?.[0]; itemB = b?.[0];
      } else {
        itemA = fallback.searchCatalogByName(args.item_a)[0];
        itemB = fallback.searchCatalogByName(args.item_b)[0];
      }
      if (!itemA) return { success: false, message: `"${args.item_a}" not found in catalog.` };
      if (!itemB) return { success: false, message: `"${args.item_b}" not found in catalog.` };
      const fitsA = room?.width && room?.depth && itemA.width <= room.width && itemA.depth <= room.depth;
      const fitsB = room?.width && room?.depth && itemB.width <= room.width && itemB.depth <= room.depth;
      return {
        success: true,
        comparison: { a: itemA, b: itemB },
        message: `**${itemA.name}** vs **${itemB.name}**\n` +
          `• Size: ${itemA.width}"×${itemA.depth}"×${itemA.height}"  vs  ${itemB.width}"×${itemB.depth}"×${itemB.height}"\n` +
          `• Price: $${itemA.price_usd || '?'}  vs  $${itemB.price_usd || '?'}\n` +
          `• Provider: ${itemA.provider}  vs  ${itemB.provider}\n` +
          `• Fits room: ${fitsA ? 'yes' : 'no'}  vs  ${fitsB ? 'yes' : 'no'}`,
      };
    }
    default:
      return { success: false, message: `Unknown function: ${fnName}` };
  }
}
