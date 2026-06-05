/**
 * Deterministic layout generator using per-room-type placement constraints.
 * No LLM required — positions are rule-based, then overlap-resolved on a 6" grid.
 */
import { getEffectiveDims, resolveOverlaps, validateLayout } from './overlapResolver.js';

export const GRID_STEP_IN = 6;
export const WALL_MARGIN_IN = 12;
export const WALKWAY_CLEARANCE_IN = 24;

/** @typedef {'bedroom'|'living_room'|'office'|'dining_room'|'studio'} RoomType */

/**
 * Room-type definitions: category order (focal first) + slot hints.
 * Slots use room-relative anchors; computePosition fills x,y,rotation.
 */
export const ROOM_LAYOUT_CONSTRAINTS = {
  bedroom: {
    label: 'Bedroom',
    categories: ['bed', 'nightstand', 'nightstand', 'dresser', 'bookshelf'],
    slots: {
      bed: { anchor: 'north_wall_center', rotation: 0, priority: 1 },
      nightstand: { anchor: 'beside_bed', side: 'alternate', rotation: 0, priority: 2 },
      dresser: { anchor: 'east_wall', rotation: 0, priority: 3 },
      bookshelf: { anchor: 'west_wall', rotation: 0, priority: 4 },
    },
    rules: [
      'Bed headboard on north wall (top), centered',
      'Nightstands flanking bed with 6" gap',
      'Dresser on east wall with walkway clearance',
    ],
  },
  living_room: {
    label: 'Living Room',
    categories: ['tv_stand', 'sofa', 'coffee_table', 'armchair', 'bookshelf'],
    slots: {
      tv_stand: { anchor: 'north_wall_center', rotation: 0, priority: 1 },
      sofa: { anchor: 'faces_focal', focal: 'tv_stand', rotation: 180, priority: 2 },
      coffee_table: { anchor: 'between_focal_and', from: 'tv_stand', to: 'sofa', rotation: 0, priority: 3 },
      armchair: { anchor: 'beside', target: 'sofa', side: 'east', rotation: 90, priority: 4 },
      bookshelf: { anchor: 'west_wall', rotation: 0, priority: 5 },
    },
    rules: [
      'TV focal point on north wall',
      'Sofa faces TV with coffee table between',
      'Armchair perpendicular to sofa conversation zone',
    ],
  },
  office: {
    label: 'Office',
    categories: ['desk', 'bookshelf', 'armchair'],
    slots: {
      desk: { anchor: 'north_wall_center', rotation: 0, priority: 1 },
      bookshelf: { anchor: 'east_wall', rotation: 0, priority: 2 },
      armchair: { anchor: 'south_of', target: 'desk', gap: 30, rotation: 0, priority: 3 },
    },
    rules: ['Desk on north wall', 'Chair south of desk facing wall'],
  },
  dining_room: {
    label: 'Dining Room',
    categories: ['dining_table', 'bookshelf'],
    slots: {
      dining_table: { anchor: 'room_center', rotation: 0, priority: 1 },
      bookshelf: { anchor: 'west_wall', rotation: 0, priority: 2 },
    },
    rules: ['Dining table centered with circulation around'],
  },
  studio: {
    label: 'Studio',
    categories: ['bed', 'sofa', 'coffee_table', 'desk', 'bookshelf'],
    slots: {
      bed: { anchor: 'northwest_corner', rotation: 0, priority: 1 },
      desk: { anchor: 'east_wall', rotation: 0, priority: 2 },
      sofa: { anchor: 'south_wall_center', rotation: 180, priority: 3 },
      coffee_table: { anchor: 'north_of', target: 'sofa', gap: 18, rotation: 0, priority: 4 },
      bookshelf: { anchor: 'west_wall', rotation: 0, priority: 5 },
    },
    rules: ['Sleep zone north-west', 'Living zone south', 'Work zone east wall'],
  },
};

const CATEGORY_ALIASES = {
  beds: 'bed',
  seating: 'sofa',
  tables: 'coffee_table',
  storage: 'bookshelf',
};

/**
 * @param {string} roomType
 * @returns {RoomType}
 */
export function normalizeRoomType(roomType) {
  const key = String(roomType || 'living_room')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (ROOM_LAYOUT_CONSTRAINTS[key]) return key;
  if (key === 'living' || key === 'livingroom') return 'living_room';
  if (key === 'bed' || key === 'master_bedroom') return 'bedroom';
  return 'living_room';
}

/**
 * @param {string} category
 */
export function normalizeCategory(category) {
  const c = String(category || '').toLowerCase();
  return CATEGORY_ALIASES[c] || c;
}

function snap(value, step = GRID_STEP_IN) {
  return Math.round(value / step) * step;
}

function clampPlacement(x, y, effW, effD, roomW, roomD) {
  const maxX = Math.max(0, roomW - effW);
  const maxY = Math.max(0, roomD - effD);
  return {
    x: snap(Math.max(0, Math.min(x, maxX))),
    y: snap(Math.max(0, Math.min(y, maxY))),
  };
}

/**
 * @param {object} item
 * @param {number} rotation
 */
function dims(item, rotation = 0) {
  return getEffectiveDims(item, rotation);
}

/**
 * @typedef {object} PlacedRef
 * @property {string} role
 * @property {object} item
 * @property {number} x
 * @property {number} y
 * @property {number} rotation
 * @property {number} effW
 * @property {number} effD
 */

/**
 * @param {PlacedRef[]} placed
 * @param {string} role
 */
function findPlaced(placed, role) {
  return placed.find((p) => p.role === role);
}

/**
 * @param {PlacedRef[]} placed
 * @param {string} category
 */
function findPlacedByCategory(placed, category) {
  return placed.find((p) => normalizeCategory(p.item.category) === category);
}

/**
 * Compute position from slot definition.
 * @param {object} slot
 * @param {object} item
 * @param {number} roomW
 * @param {number} roomD
 * @param {PlacedRef[]} placed
 * @param {{ nightstandIndex?: number }} ctx
 */
function computeSlotPosition(slot, item, roomW, roomD, placed, ctx = {}) {
  const rotation = slot.rotation ?? 0;
  let { effW, effD } = dims(item, rotation);
  let x = WALL_MARGIN_IN;
  let y = WALL_MARGIN_IN;

  const bed = findPlacedByCategory(placed, 'bed');
  const sofa = findPlacedByCategory(placed, 'sofa');
  const tv = findPlacedByCategory(placed, 'tv_stand');
  const desk = findPlacedByCategory(placed, 'desk');
  const targetRole = slot.target;
  const target =
    (targetRole && findPlaced(placed, targetRole)) ||
    (slot.target === 'sofa' && sofa) ||
    (slot.target === 'desk' && desk) ||
    (slot.from === 'tv_stand' && tv);

  switch (slot.anchor) {
    case 'north_wall_center':
      x = (roomW - effW) / 2;
      y = WALL_MARGIN_IN;
      break;
    case 'south_wall_center':
      x = (roomW - effW) / 2;
      y = roomD - effD - WALL_MARGIN_IN;
      break;
    case 'east_wall':
      x = roomW - effW - WALL_MARGIN_IN;
      y = (roomD - effD) / 2;
      break;
    case 'west_wall':
      x = WALL_MARGIN_IN;
      y = (roomD - effD) / 2;
      break;
    case 'room_center':
      x = (roomW - effW) / 2;
      y = (roomD - effD) / 2;
      break;
    case 'northwest_corner':
      x = WALL_MARGIN_IN;
      y = WALL_MARGIN_IN;
      break;
    case 'beside_bed': {
      if (!bed) break;
      const side = ctx.nightstandIndex % 2 === 0 ? 'left' : 'right';
      ctx.nightstandIndex += 1;
      if (side === 'left') {
        x = bed.x - effW - 6;
        y = bed.y + (bed.effD - effD) / 2;
      } else {
        x = bed.x + bed.effW + 6;
        y = bed.y + (bed.effD - effD) / 2;
      }
      break;
    }
    case 'faces_focal': {
      const focal = tv || findPlacedByCategory(placed, 'tv_stand');
      if (focal) {
        x = (roomW - effW) / 2;
        y = roomD - effD - WALKWAY_CLEARANCE_IN - 12;
      } else {
        x = (roomW - effW) / 2;
        y = (roomD - effD) / 2;
      }
      break;
    }
    case 'between_focal_and': {
      const from = tv || findPlacedByCategory(placed, slot.from);
      const to = sofa || findPlacedByCategory(placed, slot.to);
      if (from && to) {
        const fromFront = from.y + from.effD;
        const toBack = to.y;
        y = fromFront + Math.max(12, (toBack - fromFront - effD) / 2);
        x = (roomW - effW) / 2;
      } else {
        x = (roomW - effW) / 2;
        y = roomD / 2;
      }
      break;
    }
    case 'beside': {
      const ref = target || sofa;
      if (ref) {
        const gap = 18;
        if (slot.side === 'east') {
          x = ref.x + ref.effW + gap;
          y = ref.y + ref.effD / 2 - effD / 2;
        } else {
          x = ref.x - effW - gap;
          y = ref.y + ref.effD / 2 - effD / 2;
        }
      }
      break;
    }
    case 'south_of': {
      const ref = target || desk;
      if (ref) {
        x = ref.x + ref.effW / 2 - effW / 2;
        y = ref.y + ref.effD + (slot.gap || 24);
      }
      break;
    }
    case 'north_of': {
      const ref = target || sofa;
      if (ref) {
        x = ref.x + ref.effW / 2 - effW / 2;
        y = Math.max(WALL_MARGIN_IN, ref.y - effD - (slot.gap || 18));
      }
      break;
    }
    default:
      break;
  }

  const clamped = clampPlacement(x, y, effW, effD, roomW, roomD);
  return { ...clamped, rotation, effW, effD };
}

/**
 * Match catalog/placement items to room type category list.
 * @param {RoomType} roomType
 * @param {Array<object>} items
 */
export function selectItemsForRoomType(roomType, items) {
  const def = ROOM_LAYOUT_CONSTRAINTS[normalizeRoomType(roomType)];
  const selected = [];
  const usedIds = new Set();

  for (const cat of def.categories) {
    const norm = normalizeCategory(cat);
    const match = items.find(
      (it) =>
        !usedIds.has(it.id) &&
        (normalizeCategory(it.category) === norm ||
          (norm === 'nightstand' && normalizeCategory(it.category) === 'nightstand')),
    );
    if (match) {
      usedIds.add(match.id);
      selected.push({ ...match, _role: norm });
    }
  }
  return selected;
}

/**
 * Generate layout positions for furniture in a room.
 *
 * @param {{
 *   roomType: string,
 *   room: { width: number, depth: number, name?: string },
 *   furniture: Array<{ id: string, name?: string, category: string, width: number, depth: number, height?: number }>,
 * }} params
 * @returns {{
 *   room_type: string,
 *   method: string,
 *   placements: Array<object>,
 *   validation: { valid: boolean, errors: string[] },
 *   constraints_applied: string[],
 * }}
 */
export function generateLayout({ roomType, room, furniture }) {
  const type = normalizeRoomType(roomType);
  const def = ROOM_LAYOUT_CONSTRAINTS[type];
  const roomW = Number(room.width) || 120;
  const roomD = Number(room.depth) || 120;

  if (!furniture?.length) {
    return {
      room_type: type,
      method: 'constraint_layout_v1',
      placements: [],
      validation: { valid: true, errors: [] },
      constraints_applied: def.rules,
    };
  }

  const slotCtx = { nightstandIndex: 0 };
  const roleCounts = {};
  const placed = [];

  const sorted = [...furniture].sort((a, b) => {
    const catA = normalizeCategory(a.category);
    const catB = normalizeCategory(b.category);
    const slotA = def.slots[catA];
    const slotB = def.slots[catB];
    return (slotA?.priority ?? 99) - (slotB?.priority ?? 99);
  });

  for (const item of sorted) {
    const cat = normalizeCategory(item.category);
    roleCounts[cat] = (roleCounts[cat] || 0) + 1;
    const role = roleCounts[cat] > 1 && cat === 'nightstand' ? `nightstand_${roleCounts[cat]}` : cat;
    const slot = def.slots[cat] || { anchor: 'room_center', rotation: 0, priority: 99 };
    const pos = computeSlotPosition(slot, item, roomW, roomD, placed, slotCtx);

    placed.push({
      role,
      item,
      x: pos.x,
      y: pos.y,
      rotation: pos.rotation,
      effW: pos.effW,
      effD: pos.effD,
    });
  }

  const candidates = placed.map((p) => ({
    placement: p.item,
    rotation: p.rotation,
    x: p.x,
    y: p.y,
    effW: p.effW,
    effD: p.effD,
  }));

  const resolved = resolveOverlaps(candidates, roomW, roomD, GRID_STEP_IN);

  const placements = resolved.map((c, idx) => {
    const p = placed[idx];
    const cat = normalizeCategory(c.placement.category);
    const slot = def.slots[cat];
    return {
      id: c.placement.id,
      name: c.placement.name,
      category: c.placement.category,
      width: c.placement.width,
      depth: c.placement.depth,
      height: c.placement.height,
      x_inches: c.x,
      y_inches: c.y,
      rotation: c.rotation,
      reason: slot ? `${def.label}: ${slot.anchor}` : 'constraint_layout',
    };
  });

  const validation = validateLayout(
    placements.map((p) => ({ ...p, rotation: p.rotation })),
    { width: roomW, depth: roomD },
  );

  return {
    room_type: type,
    method: 'constraint_layout_v1',
    placements,
    validation,
    constraints_applied: def.rules,
  };
}

/**
 * Pick catalog items + generate layout in one step (for API / furnish).
 * @param {string} roomType
 * @param {{ width: number, depth: number }} room
 * @param {() => Array<object>} getCatalogItems - returns full catalog entries
 */
export function generateLayoutFromCatalog(roomType, room, getCatalogItems) {
  const items = selectItemsForRoomType(roomType, getCatalogItems());
  const furniture = items.map((it) => ({
    id: it.id || `gen-${it.category}-${it.name}`,
    name: it.name,
    category: it.category,
    width: it.width,
    depth: it.depth,
    height: it.height,
    catalog_id: it.id,
    provider: it.provider,
    image_url: it.image_url,
    model_url: it.model_url,
    price_usd: it.price_usd,
  }));
  const layout = generateLayout({ roomType, room, furniture });
  return { ...layout, catalog_items: items, furniture };
}
