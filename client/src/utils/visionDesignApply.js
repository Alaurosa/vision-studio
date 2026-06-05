/**
 * Apply structured project globalVision to editable editor state.
 */

import { STARTER_FURNITURE_CATALOG } from '@/data/furnitureCatalog';
import {
  DEFAULT_ROOM_INTERIOR,
  WALL_COLOR_PRESETS,
  isInteriorUserEdited,
  normalizeRoomInterior,
} from '@/data/roomInterior';
import { normalizeGlobalVision } from '@/utils/projectVision';
import { normalizeGuidedVisionFields, inferRoomChipType } from '@/utils/guidedVisionFlow';
import { recommendForRoom } from '@/utils/recommendationRules';
import { createPlacedFurnitureFromCatalogItem } from '@/utils/furniturePlacement';
import { getZoneBoundsInches } from '@/utils/roomView3d';
import { getAABB, overlaps } from '@/utils/collision';
import { GRID_SNAP_INCHES } from '@/utils/constants';

function itemInZone(item, zone) {
  if (!zone) return false;
  if (item.zone_id && zone.id) return item.zone_id === zone.id;
  const bounds = getZoneBoundsInches(zone);
  if (!bounds) return false;
  const box = getAABB(item);
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  return (
    cx >= bounds.left &&
    cx <= bounds.right &&
    cy >= bounds.top &&
    cy <= bounds.bottom
  );
}

const MOOD_TO_STYLE_HINT = {
  warm: 'cozy',
  modern: 'modern',
  minimal: 'minimal',
  coastal: 'neutral',
  organic: 'neutral',
  cozy: 'cozy',
  bright: 'neutral',
  sophisticated: 'modern',
};

const MOOD_TO_WALL_PRESET = {
  warm: 'clay',
  modern: 'soft-gray',
  minimal: 'warm-white',
  coastal: 'soft-gray',
  organic: 'sage',
  cozy: 'clay',
  bright: 'warm-white',
  sophisticated: 'slate',
};

const PRIORITY_TO_LAYOUT_INTENT = {
  'better flow': 'open-flow',
  'hosting guests': 'cozy-nook',
  'family-friendly': 'balanced',
  relaxing: 'cozy-nook',
  productivity: 'commanding',
  'budget-conscious': 'balanced',
  'multi-functional rooms': 'balanced',
};

const ROOM_TYPE_LAYOUT = {
  living: [
    { category: 'seating', relX: 0.5, relY: 0.62 },
    { category: 'tables', relX: 0.5, relY: 0.48 },
    { category: 'lighting', relX: 0.22, relY: 0.28 },
  ],
  dining: [
    { category: 'tables', relX: 0.5, relY: 0.5 },
    { category: 'seating', relX: 0.38, relY: 0.55 },
    { category: 'seating', relX: 0.62, relY: 0.55 },
  ],
  kitchen: [
    { category: 'storage', relX: 0.2, relY: 0.35 },
    { category: 'tables', relX: 0.55, relY: 0.5 },
  ],
  bedroom: [
    { category: 'beds', relX: 0.55, relY: 0.55 },
    { category: 'storage', relX: 0.2, relY: 0.45 },
  ],
  office: [
    { category: 'tables', relX: 0.45, relY: 0.5 },
    { category: 'storage', relX: 0.78, relY: 0.4 },
    { category: 'lighting', relX: 0.45, relY: 0.28 },
  ],
  default: [
    { category: 'seating', relX: 0.5, relY: 0.55 },
    { category: 'storage', relX: 0.25, relY: 0.4 },
  ],
};

const NEED_TO_CATEGORIES = {
  hosting: ['seating', 'tables'],
  'conversation seating': ['seating'],
  'tv watching': ['seating', 'tables'],
  'more storage': ['storage'],
  'better storage': ['storage'],
  'calm sleeping area': ['beds'],
  productivity: ['tables', 'lighting'],
  'reading nook': ['seating', 'lighting'],
};

export function computeVisionDesignRevision(gv) {
  const n = normalizeGuidedVisionFields(normalizeGlobalVision(gv));
  return JSON.stringify({
    mood: n.moodTags,
    pri: n.priorities,
    con: n.constraints,
    rooms: n.prioritizedRooms,
    needs: n.roomSpecificNeeds,
    notes: n.notes,
  });
}

export function deriveStyleHintFromVision(gv) {
  const n = normalizeGuidedVisionFields(normalizeGlobalVision(gv));
  for (const mood of n.moodTags) {
    const key = mood.toLowerCase();
    if (MOOD_TO_STYLE_HINT[key]) return MOOD_TO_STYLE_HINT[key];
  }
  if (n.constraints.some((c) => /small/i.test(c))) return 'compact';
  return n.moodTags[0] ? MOOD_TO_STYLE_HINT[n.moodTags[0].toLowerCase()] || 'neutral' : null;
}

/**
 * Vision-derived interior (source: vision). Does not overwrite user edits when applied via guard.
 */
export function deriveInteriorFromVision(gv, existingInterior = {}) {
  const n = normalizeGuidedVisionFields(normalizeGlobalVision(gv));
  const base = normalizeRoomInterior({ ...DEFAULT_ROOM_INTERIOR, ...existingInterior });

  let layoutIntent = base.layoutIntent || 'balanced';
  for (const p of n.priorities) {
    const key = p.toLowerCase();
    if (PRIORITY_TO_LAYOUT_INTENT[key]) {
      layoutIntent = PRIORITY_TO_LAYOUT_INTENT[key];
      break;
    }
  }
  if (/open walkway|better flow/i.test(n.priorities.join(' '))) layoutIntent = 'open-flow';

  let wallPresetId = 'warm-white';
  for (const mood of n.moodTags) {
    const id = MOOD_TO_WALL_PRESET[mood.toLowerCase()];
    if (id) {
      wallPresetId = id;
      break;
    }
  }
  const preset = WALL_COLOR_PRESETS.find((p) => p.id === wallPresetId) || WALL_COLOR_PRESETS[0];

  let wallpaperId = base.wallpaperId;
  if (!wallpaperId && n.moodTags.some((m) => /organic|coastal/i.test(m))) {
    wallpaperId = n.moodTags.some((m) => /organic/i.test(m)) ? 'botanical' : 'linen';
  }
  if (n.constraints.some((c) => /minimal/i.test(c))) wallpaperId = null;

  return normalizeRoomInterior({
    ...base,
    wallColor: preset.color,
    wallpaperId,
    layoutIntent,
    source: 'vision',
    visionRevision: computeVisionDesignRevision(gv),
    visionMoodTags: n.moodTags,
    visionPriorities: n.priorities,
    appliedFromVisionRevision: computeVisionDesignRevision(gv),
  });
}

/**
 * @param {object} params
 * @returns {object}
 */
export function buildVisionDesignPlan({
  globalVision,
  room,
  zones = [],
  activeZone = null,
  activeSpace = null,
  furniture = [],
}) {
  const revision = computeVisionDesignRevision(globalVision);
  const styleHint = deriveStyleHintFromVision(globalVision);
  const zone = activeZone || zones[0] || null;
  const roomName = activeSpace?.name || activeZone?.name || room?.name || 'Room';
  const n = normalizeGuidedVisionFields(normalizeGlobalVision(globalVision));

  const needsForZone =
    (activeZone?.id && n.roomSpecificNeeds[activeZone.id]) ||
    Object.values(n.roomSpecificNeeds || {}).flat();

  const interiorPatch = isInteriorUserEdited(room?.interior)
    ? null
    : deriveInteriorFromVision(globalVision, room?.interior);

  const furniturePlan = buildFurnitureLayoutPlan({
    globalVision,
    room,
    zone,
    activeSpace,
    furniture,
    needsLabels: needsForZone,
  });

  return {
    roomId: room?.id || null,
    roomName,
    zoneId: zone?.id || null,
    interiorPatch,
    furniturePlan,
    layoutIntent: interiorPatch?.layoutIntent || room?.interior?.layoutIntent,
    recommendations: furniturePlan.recommendations,
    styleHint,
    appliedFromVisionRevision: revision,
  };
}

function findOpenSlotInBounds(w, d, bounds, existing) {
  const step = GRID_SNAP_INCHES;
  const minX = Math.max(step, bounds.left + step);
  const minY = Math.max(step, bounds.top + step);
  const maxX = bounds.right - step;
  const maxY = bounds.bottom - step;
  for (let y = minY; y + d <= maxY; y += step) {
    for (let x = minX; x + w <= maxX; x += step) {
      const box = { left: x, top: y, right: x + w, bottom: y + d };
      const clash = existing.some((f) => overlaps(box, getAABB(f)));
      if (!clash) return { x, y };
    }
  }
  return {
    x: minX,
    y: minY,
  };
}

function buildFurnitureLayoutPlan({
  globalVision,
  room,
  zone,
  activeSpace,
  furniture,
  needsLabels = [],
}) {
  const bounds = getZoneBoundsInches(zone);
  if (!bounds || !room) {
    return { placements: [], recommendations: [] };
  }

  const inZone = furniture.filter((f) => itemInZone(f, zone));
  if (inZone.length > 0) {
    return { placements: [], recommendations: [], skipped: 'zone_has_furniture' };
  }

  const styleHint = deriveStyleHintFromVision(globalVision);
  const zoneRoom = { width: bounds.width, depth: bounds.depth, height: room.height || 96 };
  const roomType = inferRoomChipType(activeSpace || { name: zone?.name, category: zone?.name });
  const layoutSlots = [...(ROOM_TYPE_LAYOUT[roomType] || ROOM_TYPE_LAYOUT.default)];

  const categories = new Set();
  for (const label of needsLabels) {
    const cats = NEED_TO_CATEGORIES[String(label).toLowerCase()];
    if (cats) cats.forEach((c) => categories.add(c));
  }
  const n = normalizeGuidedVisionFields(normalizeGlobalVision(globalVision));
  if (n.priorities.some((p) => /host/i.test(p))) categories.add('seating');
  if (n.priorities.some((p) => /storage/i.test(p))) categories.add('storage');
  for (const c of categories) {
    if (!layoutSlots.some((s) => s.category === c)) {
      layoutSlots.push({ category: c, relX: 0.5, relY: 0.5 });
    }
  }

  const placements = [];
  const placed = [];
  const recommendations = [];

  for (const slot of layoutSlots.slice(0, 4)) {
    const result = recommendForRoom({
      room: zoneRoom,
      placements: [...inZone, ...placed],
      catalog: STARTER_FURNITURE_CATALOG,
      category: slot.category,
      options: { styleHint: styleHint || undefined, maxResults: 1, perCategoryMax: 1 },
    });
    const entry = result?.items?.[0];
    if (!entry?.item) continue;
    recommendations.push(entry.item);

    const { width, depth } = entry.item.footprint || entry.item.dimensions || { width: 24, depth: 24 };
    const targetX = bounds.left + bounds.width * slot.relX;
    const targetY = bounds.top + bounds.depth * slot.relY;
    const slotPos = findOpenSlotInBounds(width, depth, bounds, [...inZone, ...placed]);
    const useX = Math.abs(slotPos.x - targetX) < bounds.width * 0.4 ? slotPos.x : targetX - width / 2;
    const useY = Math.abs(slotPos.y - targetY) < bounds.depth * 0.4 ? slotPos.y : targetY - depth / 2;

    const placement = createPlacedFurnitureFromCatalogItem(
      entry.item,
      { x_inches: useX, y_inches: useY },
      { center: false },
    );
    placement.zone_id = zone.id;
    placements.push(placement);
    placed.push(placement);
  }

  return { placements, recommendations };
}

/**
 * @param {object} params
 * @param {{ force?: boolean, applyInterior?: boolean, applyFurniture?: boolean }} [options]
 */
export async function applyVisionDesignToEditor(
  {
    globalVision,
    room,
    zones,
    furniture,
    activeZone,
    activeSpace = null,
    updateRoom,
    addFurniture,
    setRecommendedItems,
  },
  options = {},
) {
  if (!room || !globalVision) return { applied: false };

  const { force = false, applyInterior = true, applyFurniture = true } = options;
  const plan = buildVisionDesignPlan({
    globalVision,
    room,
    zones,
    activeZone,
    activeSpace,
    furniture,
  });
  const revision = plan.appliedFromVisionRevision;
  const currentInterior = room.interior || {};

  let interiorUpdated = false;
  if (
    applyInterior &&
    plan.interiorPatch &&
    (!isInteriorUserEdited(currentInterior) || force)
  ) {
    const alreadyApplied = currentInterior.appliedFromVisionRevision === revision;
    if (!alreadyApplied || force) {
      await updateRoom({
        interior: plan.interiorPatch,
      });
      interiorUpdated = true;
    }
  }

  const styleHint = plan.styleHint;
  const zone = activeZone || zones[0] || null;
  const zoneRoom = zone
    ? {
        width: getZoneBoundsInches(zone)?.width || room.width,
        depth: getZoneBoundsInches(zone)?.depth || room.depth,
        height: room.height,
      }
    : room;

  if (setRecommendedItems && zoneRoom?.width && zoneRoom?.depth) {
    const rec = recommendForRoom({
      room: zoneRoom,
      placements: furniture,
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'seating',
      options: { styleHint: styleHint || undefined, maxResults: 6, perCategoryMax: 2 },
    });
    setRecommendedItems(rec?.items?.map((e) => e.item) || []);
  }

  let added = 0;
  const placementsRevision = currentInterior.visionPlacementsRevision;
  const canPlaceFurniture =
    applyFurniture && (force || placementsRevision !== revision);

  if (canPlaceFurniture) {
    const targets = force
      ? zones.filter((z) => furniture.filter((f) => itemInZone(f, z)).length === 0).slice(0, 4)
      : activeZone
        ? [activeZone]
        : [];

    for (const z of targets) {
      const zonePlan =
        z.id === plan.zoneId
          ? plan.furniturePlan
          : buildFurnitureLayoutPlan({
              globalVision,
              room,
              zone: z,
              activeSpace,
              furniture: [...furniture],
              needsLabels: [],
            });
      if (!zonePlan.placements?.length) continue;
      for (const placement of zonePlan.placements) {
        // eslint-disable-next-line no-await-in-loop
        await addFurniture(placement);
        added += 1;
      }
    }
    if (added > 0) {
      await updateRoom({
        interior: normalizeRoomInterior({
          ...(room.interior || {}),
          visionPlacementsRevision: revision,
        }),
      });
    }
  }

  return {
    applied: true,
    plan,
    revision,
    placementsAdded: added,
    styleHint,
    interiorUpdated,
  };
}

/** @deprecated use buildFurnitureLayoutPlan */
export function pickVisionStarterPlacements(params) {
  const needsLabels = Object.values(
    normalizeGuidedVisionFields(normalizeGlobalVision(params.globalVision)).roomSpecificNeeds || {},
  ).flat();
  return buildFurnitureLayoutPlan({
    globalVision: params.globalVision,
    room: params.room,
    zone: params.zone,
    activeSpace: null,
    furniture: params.existingFurniture || [],
    needsLabels,
  }).placements;
}
