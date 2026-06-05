/**
 * Chat tool definitions and execution logic.
 */
import { useDb, supabaseAdmin, fallback } from './db.js';
import { chat } from './llmRouter.js';
import { getEffectiveDims, validateLayout, CLEARANCE_IN } from './overlapResolver.js';
import { generateLayout } from './layoutGenerator.js';
import { autoArrangeFurniture } from './autoArrange.js';
import {
  filterPlacementsForZone,
  findOpenSlotInZone,
  globalizeLayoutPosition,
  layoutRoomForZone,
} from './zonePlacement.js';

/** Fuzzy match: all words in needle must appear in haystack (diacritics-insensitive). */
function fuzzyMatch(haystack, needle) {
  const strip = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const words = strip(needle).split(/\s+/).filter(Boolean);
  const h = strip(haystack);
  return words.every(w => h.includes(w));
}

/** Find a placement by fuzzy name match. */
function findPlacement(placements, name) {
  return placements.find(p => fuzzyMatch(p.name || '', name));
}

async function dbUpdatePlacement(id, patch) {
  const { error } = await supabaseAdmin
    .from('placements')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  return error?.message || null;
}

async function dbInsertPlacement(placement) {
  let { data, error } = await supabaseAdmin.from('placements').insert(placement).select().single();
  if (error && placement.image_url && /image_url/i.test(error.message || '')) {
    const { image_url, ...rest } = placement;
    ({ data, error } = await supabaseAdmin.from('placements').insert(rest).select().single());
    if (!error && data) {
      return { error: null, data: { ...data, image_url } };
    }
  }
  if (error) return { error: error.message, data: null };
  return { error: null, data };
}

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
export async function executeFunction(fnName, args, roomId, placements, room, db, zoneContext = null) {
  const scoped = filterPlacementsForZone(placements, zoneContext);
  const layoutRoom = layoutRoomForZone(zoneContext, room);

  switch (fnName) {
    case 'move_furniture': {
      const p = findPlacement(scoped, args.furniture_name);
      if (!p) return { success: false, message: `Furniture "${args.furniture_name}" not found` };
      if (db) {
        const err = await dbUpdatePlacement(p.id, { x_inches: args.x_inches, y_inches: args.y_inches });
        if (err) return { success: false, message: err };
      } else {
        fallback.updatePlacement(p.id, { x_inches: args.x_inches, y_inches: args.y_inches });
      }
      return {
        success: true,
        placement_id: p.id,
        message: `Moved ${p.name} to (${args.x_inches}", ${args.y_inches}")`,
      };
    }
    case 'rotate_furniture': {
      const p = findPlacement(scoped, args.furniture_name);
      if (!p) return { success: false, message: `Furniture "${args.furniture_name}" not found` };
      if (db) {
        const err = await dbUpdatePlacement(p.id, { rotation: args.rotation });
        if (err) return { success: false, message: err };
      } else {
        fallback.updatePlacement(p.id, { rotation: args.rotation });
      }
      return {
        success: true,
        placement_id: p.id,
        message: `Rotated ${p.name} to ${args.rotation}°`,
      };
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

      let x = args.x_inches;
      let y = args.y_inches;
      if (x == null || y == null) {
        const slot = findOpenSlotInZone(scoped, item.width, item.depth, zoneContext, room);
        x = slot.x;
        y = slot.y;
      }

      const placement = {
        room_id: roomId,
        catalog_id: item.id,
        name: item.name,
        category: item.category,
        provider: item.provider,
        width: item.width,
        depth: item.depth,
        height: item.height,
        x_inches: x,
        y_inches: y,
        rotation: args.rotation || 0,
        color: '#d4a27a',
        image_url: item.image_url || null,
        model_url: item.model_url || null,
        zone_id: zoneContext?.id || null,
      };
      if (db) {
        const { error, data } = await dbInsertPlacement(placement);
        if (error) return { success: false, message: error };
        return {
          success: true,
          message: `Added ${item.name} to the room`,
          added_item: { ...data, image_url: item.image_url, model_url: item.model_url },
        };
      }
      const added = fallback.addPlacement(placement);
      return {
        success: true,
        message: `Added ${item.name} to the room`,
        added_item: { ...added, image_url: item.image_url, model_url: item.model_url },
      };
    }
    case 'remove_furniture': {
      const p = findPlacement(scoped, args.furniture_name);
      if (!p) return { success: false, message: `Furniture "${args.furniture_name}" not found` };
      if (db) {
        const { error } = await supabaseAdmin.from('placements').delete().eq('id', p.id);
        if (error) return { success: false, message: error.message };
      } else {
        fallback.deletePlacement(p.id);
      }
      return {
        success: true,
        placement_id: p.id,
        message: `Removed ${p.name} from the room`,
      };
    }
    case 'validate_layout': {
      const roomForValidation = {
        width: Number(room?.width) || layoutRoom.width,
        depth: Number(room?.depth) || layoutRoom.depth,
      };
      return {
        success: true,
        ...validateLayout(scoped, roomForValidation, {
          clearance: CLEARANCE_IN,
          bounds: zoneContext?.bounds || null,
        }),
      };
    }
    case 'arrange_room': {
      if (scoped.length === 0) return { success: false, message: 'No furniture to arrange in the active space' };
      if (!layoutRoom?.width || !layoutRoom?.depth) return { success: false, message: 'Room dimensions not set' };

      const result = autoArrangeFurniture({ room, placements, zoneContext });
      if (!result.placements.length) {
        return { success: false, message: 'Nothing to arrange in the active space' };
      }

      for (const p of result.placements) {
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

      const plan = result.plan;
      const orderSummary = plan?.placement_order
        ?.slice(0, 3)
        .map((s) => s.name)
        .join(', ');
      const styleNote = args.style ? ` (${args.style} style)` : '';
      const validNote = result.validation.valid ? '' : ` Note: ${result.validation.errors[0]}`;

      return {
        success: true,
        message: `Planned ${plan?.room_label || 'room'} layout${styleNote}: ${orderSummary || `${result.placements.length} items`} — ${CLEARANCE_IN}" clearance, no overlaps.${validNote}`,
        refresh: true,
        plan,
        placements: result.placements,
      };
    }
    case 'swap_furniture': {
      const current = findPlacement(scoped, args.current_furniture_name);
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
        await dbInsertPlacement({
          room_id: roomId,
          catalog_id: newItem.id,
          name: newItem.name,
          category: newItem.category,
          provider: newItem.provider,
          width: newItem.width,
          depth: newItem.depth,
          height: newItem.height,
          x_inches: pos.x_inches,
          y_inches: pos.y_inches,
          rotation: pos.rotation,
          color: '#d4a27a',
          image_url: newItem.image_url || null,
          model_url: newItem.model_url || null,
          zone_id: current.zone_id || zoneContext?.id || null,
        });
      } else {
        fallback.deletePlacement(current.id);
        fallback.addPlacement({
          room_id: roomId,
          catalog_id: newItem.id,
          name: newItem.name,
          category: newItem.category,
          provider: newItem.provider,
          width: newItem.width,
          depth: newItem.depth,
          height: newItem.height,
          x_inches: pos.x_inches,
          y_inches: pos.y_inches,
          rotation: pos.rotation,
          zone_id: current.zone_id || zoneContext?.id || null,
          color: '#d4a27a',
          image_url: newItem.image_url || null,
          model_url: newItem.model_url || null,
        });
      }
      return {
        success: true,
        message: `Replaced ${current.name} with ${newItem.name}`,
        refresh: true,
        removed_placement_id: current.id,
        removed_name: current.name,
        added_item: {
          name: newItem.name,
          category: newItem.category,
          provider: newItem.provider,
          width: newItem.width,
          depth: newItem.depth,
          height: newItem.height,
          x_inches: pos.x_inches,
          y_inches: pos.y_inches,
          rotation: pos.rotation,
          color: '#d4a27a',
          image_url: newItem.image_url,
          model_url: newItem.model_url,
        },
      };
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
        if (pick.width > layoutRoom.width || pick.depth > layoutRoom.depth) {
          if (pick.depth <= layoutRoom.width && pick.width <= layoutRoom.depth) {
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
      let tempScoped = [...scoped];
      for (const item of selectedItems) {
        const slot = findOpenSlotInZone(tempScoped, item.width, item.depth, zoneContext, room);
        const placement = {
          room_id: roomId,
          catalog_id: item.id,
          name: item.name,
          category: item.category,
          provider: item.provider,
          width: item.width,
          depth: item.depth,
          height: item.height,
          x_inches: slot.x,
          y_inches: slot.y,
          rotation: item._rotation || 0,
          color: '#d4a27a',
          image_url: item.image_url || null,
          model_url: item.model_url || null,
          zone_id: zoneContext?.id || null,
        };
        let newP;
        if (db) {
          const { data } = await dbInsertPlacement(placement);
          newP = data;
        } else {
          newP = fallback.addPlacement(placement);
        }
        if (newP) {
          added.push(newP);
          tempScoped = [...tempScoped, newP];
        }
      }

      let allPlacements;
      if (db) {
        const { data } = await supabaseAdmin.from('placements').select('*').eq('room_id', roomId);
        allPlacements = data || [];
      } else {
        allPlacements = fallback.getPlacementsForRoom(roomId);
      }

      const zonePlacements = zoneContext?.id
        ? allPlacements.filter(
            (p) => p.zone_id === zoneContext.id || added.some((a) => a.id === p.id),
          )
        : allPlacements;

      const layout = generateLayout({
        roomType: args.room_type,
        room: layoutRoom,
        furniture: zonePlacements.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          width: p.width,
          depth: p.depth,
          height: p.height,
        })),
      });

      for (const pos of layout.placements) {
        const global = globalizeLayoutPosition(pos, zoneContext);
        const patch = {
          x_inches: global.x_inches,
          y_inches: global.y_inches,
          rotation: pos.rotation,
          updated_at: new Date().toISOString(),
        };
        if (db) {
          await supabaseAdmin.from('placements').update(patch).eq('id', pos.id);
        } else {
          fallback.updatePlacement(pos.id, patch);
        }
      }

      let finalPlacements;
      if (db) {
        const { data } = await supabaseAdmin.from('placements').select('*').eq('room_id', roomId);
        finalPlacements = data || [];
      } else {
        finalPlacements = fallback.getPlacementsForRoom(roomId);
      }

      const arrangedItems = selectedItems.map((item, idx) => {
        const placed = added[idx] ? finalPlacements.find((p) => p.id === added[idx].id) : null;
        return {
          ...item,
          x_inches: placed?.x_inches ?? 12,
          y_inches: placed?.y_inches ?? 12,
          rotation: placed?.rotation ?? 0,
          zone_id: zoneContext?.id || placed?.zone_id || null,
        };
      });

      const arrangeResult = {
        success: layout.validation.valid,
        message: layout.validation.valid
          ? `Constraint layout (${layout.room_type})`
          : `Layout has issues: ${layout.validation.errors.join('; ')}`,
      };

      const totalCost = selectedItems.reduce((sum, it) => sum + (it.price_usd || 0), 0);
      const itemNames = selectedItems.map(it => it.name).join(', ');

      return {
        success: true,
        message: `Furnished ${(args.room_type || 'room').replace('_', ' ')} with ${selectedItems.length} items: ${itemNames}. Total estimated cost: $${totalCost.toFixed(0)}. ${arrangeResult.success ? 'Placed using room constraints.' : arrangeResult.message}`,
        refresh: true,
        suggestions: arrangedItems,
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
      if (scoped.length === 0) {
        return {
          success: true,
          message: zoneContext?.id ? 'This space is already empty.' : 'Room is already empty.',
        };
      }
      const count = scoped.length;
      for (const p of scoped) {
        if (db) {
          await supabaseAdmin.from('placements').delete().eq('id', p.id);
        } else {
          fallback.deletePlacement(p.id);
        }
      }
      return { success: true, message: `Removed all ${count} items from the room.`, refresh: true };
    }
    case 'estimate_budget': {
      if (scoped.length === 0) return { success: true, message: 'Room is empty — no cost to estimate.' };
      let total = 0;
      const items = [];
      for (const p of scoped) {
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
      const roomW = layoutRoom.width || 0;
      const roomD = layoutRoom.depth || 0;
      const areaFt = (roomW * roomD) / 144;
      let furnitureArea = 0;
      for (const p of scoped) {
        const { effW, effD } = getEffectiveDims(p, p.rotation || 0);
        furnitureArea += effW * effD;
      }
      const coveragePct = roomW && roomD ? ((furnitureArea / (roomW * roomD)) * 100).toFixed(1) : 0;
      const roomForValidation = zoneContext?.bounds
        ? { ...room, width: layoutRoom.width, depth: layoutRoom.depth }
        : room;
      const validation = validateLayout(scoped, roomForValidation);
      const categories = {};
      for (const p of scoped) {
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
