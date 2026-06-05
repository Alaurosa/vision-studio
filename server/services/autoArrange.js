/**
 * Auto-arrange: analyze → constraint placement → overlap repair.
 * Replaces raw LLM coordinate guessing with deterministic layout + guaranteed de-overlap.
 */
import {
  generateLayout,
  normalizeCategory,
  normalizeRoomType,
  ROOM_LAYOUT_CONSTRAINTS,
} from './layoutGenerator.js';
import {
  getEffectiveDims,
  resolveOverlaps,
  validateLayout,
  CLEARANCE_IN,
  GRID_STEP_IN,
} from './overlapResolver.js';
import {
  filterPlacementsForZone,
  globalizeLayoutPosition,
  layoutRoomForZone,
} from './zonePlacement.js';

const FOCAL_PRIORITY = ['tv_stand', 'bed', 'dining_table', 'desk', 'sofa'];

/**
 * Infer the best constraint template from furniture categories present.
 * @param {object[]} placements
 */
export function inferRoomType(placements) {
  const cats = new Set(placements.map((p) => normalizeCategory(p.category)));
  if (cats.has('bed') && (cats.has('sofa') || cats.has('coffee_table') || cats.has('desk'))) {
    return 'studio';
  }
  if (cats.has('bed')) return 'bedroom';
  if (cats.has('dining_table')) return 'dining_room';
  if (cats.has('desk') && !cats.has('sofa') && !cats.has('tv_stand')) return 'office';
  if (cats.has('sofa') || cats.has('tv_stand') || cats.has('coffee_table') || cats.has('armchair')) {
    return 'living_room';
  }
  return 'living_room';
}

/**
 * @param {object[]} placements
 */
function pickFocalCategory(placements) {
  const cats = placements.map((p) => normalizeCategory(p.category));
  return FOCAL_PRIORITY.find((c) => cats.includes(c)) || cats[0] || null;
}

/**
 * @param {object} item
 * @param {string} roomType
 */
function placementRationale(item, roomType) {
  const cat = normalizeCategory(item.category);
  const def = ROOM_LAYOUT_CONSTRAINTS[normalizeRoomType(roomType)];
  const slot = def?.slots?.[cat];
  if (slot?.anchor) {
    return `${def.label}: ${slot.anchor.replace(/_/g, ' ')}`;
  }
  if (FOCAL_PRIORITY.includes(cat)) return `Anchor ${cat} as focal piece`;
  return 'Place with walkway clearance after focal items';
}

/**
 * Explicit planning step (rule-based "thinking" before coordinates).
 * @param {object[]} placements
 * @param {{ width: number, depth: number, name?: string }} layoutRoom
 */
export function buildArrangePlan(placements, layoutRoom) {
  const roomType = inferRoomType(placements);
  const def = ROOM_LAYOUT_CONSTRAINTS[normalizeRoomType(roomType)];
  const focal = pickFocalCategory(placements);

  const priority = [...placements].sort((a, b) => {
    const catA = normalizeCategory(a.category);
    const catB = normalizeCategory(b.category);
    const slotA = def?.slots?.[catA];
    const slotB = def?.slots?.[catB];
    const priA = slotA?.priority ?? (FOCAL_PRIORITY.indexOf(catA) >= 0 ? FOCAL_PRIORITY.indexOf(catA) + 1 : 50);
    const priB = slotB?.priority ?? (FOCAL_PRIORITY.indexOf(catB) >= 0 ? FOCAL_PRIORITY.indexOf(catB) + 1 : 50);
    if (priA !== priB) return priA - priB;
    const areaA = (a.width || 24) * (a.depth || 24);
    const areaB = (b.width || 24) * (b.depth || 24);
    return areaB - areaA;
  });

  return {
    room_type: roomType,
    room_label: def?.label || 'Room',
    focal_category: focal,
    design_rules: def?.rules || [],
    placement_order: priority.map((p, index) => ({
      step: index + 1,
      id: p.id,
      name: p.name,
      category: p.category,
      rationale: placementRationale(p, roomType),
    })),
    room_bounds: { width: layoutRoom.width, depth: layoutRoom.depth },
    clearance_inches: CLEARANCE_IN,
  };
}

/**
 * @param {object[]} placements
 * @param {object} room
 * @param {object | null} zoneContext
 */
export function repairPlacements(placements, room, zoneContext = null) {
  const roomW = Number(room.width) || 120;
  const roomD = Number(room.depth) || 120;
  const bounds = zoneContext?.bounds || null;

  const sorted = [...placements].sort((a, b) => {
    const da = getEffectiveDims(a, a.rotation || 0);
    const db = getEffectiveDims(b, b.rotation || 0);
    return db.effW * db.effD - da.effW * da.effD;
  });

  const candidates = sorted.map((p) => {
    const rotation = [0, 90, 180, 270].includes(p.rotation) ? p.rotation : 0;
    const { effW, effD } = getEffectiveDims(p, rotation);
    return {
      placement: p,
      rotation,
      x: Number(p.x_inches) || 0,
      y: Number(p.y_inches) || 0,
      effW,
      effD,
    };
  });

  const resolved = resolveOverlaps(candidates, roomW, roomD, GRID_STEP_IN, { bounds, clearance: CLEARANCE_IN });

  return resolved.map((c) => ({
    ...c.placement,
    x_inches: c.x,
    y_inches: c.y,
    rotation: c.rotation,
    zone_id: c.placement.zone_id || zoneContext?.id || null,
  }));
}

/**
 * @param {{
 *   room: { width: number, depth: number, name?: string },
 *   placements: object[],
 *   zoneContext?: object | null,
 * }} params
 */
export function autoArrangeFurniture({ room, placements, zoneContext = null }) {
  const layoutRoom = layoutRoomForZone(zoneContext, room);
  const scoped = zoneContext ? filterPlacementsForZone(placements, zoneContext) : placements;

  if (scoped.length === 0) {
    return {
      method: 'auto_arrange_v2',
      plan: null,
      placements: [],
      validation: { valid: true, errors: [] },
    };
  }

  const plan = buildArrangePlan(scoped, layoutRoom);
  const layout = generateLayout({
    roomType: plan.room_type,
    room: layoutRoom,
    furniture: scoped.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      width: p.width,
      depth: p.depth,
      height: p.height,
    })),
  });

  let finalPlacements = layout.placements.map((p) => {
    const global = globalizeLayoutPosition(
      { x_inches: p.x_inches, y_inches: p.y_inches },
      zoneContext,
    );
    const source = scoped.find((s) => s.id === p.id);
    return {
      id: p.id,
      name: p.name,
      x_inches: global.x_inches,
      y_inches: global.y_inches,
      rotation: p.rotation,
      zone_id: source?.zone_id || zoneContext?.id || null,
    };
  });

  const validationRoom = {
    width: Number(room.width) || layoutRoom.width,
    depth: Number(room.depth) || layoutRoom.depth,
  };

  let validation = validateLayout(
    finalPlacements.map((p) => {
      const src = scoped.find((s) => s.id === p.id);
      return { ...src, ...p };
    }),
    validationRoom,
    { clearance: CLEARANCE_IN, bounds: zoneContext?.bounds || null },
  );

  if (!validation.valid) {
    const merged = scoped.map((src) => {
      const updated = finalPlacements.find((p) => p.id === src.id);
      return { ...src, ...updated };
    });
    finalPlacements = repairPlacements(merged, validationRoom, zoneContext).map((p) => ({
      id: p.id,
      name: p.name,
      x_inches: p.x_inches,
      y_inches: p.y_inches,
      rotation: p.rotation,
      zone_id: p.zone_id,
    }));
    validation = validateLayout(
      finalPlacements.map((p) => {
        const src = scoped.find((s) => s.id === p.id);
        return { ...src, ...p };
      }),
      validationRoom,
      { clearance: CLEARANCE_IN, bounds: zoneContext?.bounds || null },
    );
  }

  return {
    method: 'auto_arrange_v2',
    plan,
    placements: finalPlacements,
    validation,
    constraints_applied: layout.constraints_applied,
  };
}
