/**
 * Apply structured project globalVision to editable editor state (interior, catalog hints, starter placements).
 */

import { STARTER_FURNITURE_CATALOG } from '@/data/furnitureCatalog';
import { DEFAULT_ROOM_INTERIOR, WALL_COLOR_PRESETS } from '@/data/roomInterior';
import { normalizeGlobalVision } from '@/utils/projectVision';
import { normalizeGuidedVisionFields } from '@/utils/guidedVisionFlow';
import { recommendForRoom } from '@/utils/recommendationRules';
import { createPlacedFurnitureFromCatalogItem } from '@/utils/furniturePlacement';
import { getZoneBoundsInches } from '@/utils/roomView3d';
import { getAABB } from '@/utils/collision';

function itemInZone(item, zone) {
  if (!zone) return false;
  if (item.zone_id && zone.id) return item.zone_id === zone.id;
  const bounds = getZoneBoundsInches(zone);
  if (!bounds) return false;
  const box = getAABB(item);
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  return (
    cx >= bounds.left && cx <= bounds.right && cy >= bounds.top && cy <= bounds.bottom
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

const ROOM_NEED_TO_CATEGORY = {
  'conversation seating': 'seating',
  'tv watching': 'seating',
  hosting: 'seating',
  'reading nook': 'seating',
  'more storage': 'storage',
  'better storage': 'storage',
  'calm sleeping area': 'beds',
  productivity: 'tables',
};

/**
 * Stable revision string — when vision chips change, design re-applies.
 * @param {object | null | undefined} gv
 */
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

/**
 * @param {object | null | undefined} gv
 * @returns {string | null}
 */
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
 * @param {object | null | undefined} gv
 * @param {object} [existingInterior]
 */
export function deriveInteriorFromVision(gv, existingInterior = {}) {
  const n = normalizeGuidedVisionFields(normalizeGlobalVision(gv));
  const base = { ...DEFAULT_ROOM_INTERIOR, ...existingInterior };

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

  return {
    ...base,
    wallColor: preset.color,
    layoutIntent,
    visionRevision: computeVisionDesignRevision(gv),
    visionMoodTags: n.moodTags,
    visionPriorities: n.priorities,
  };
}

/**
 * Pick starter catalog placements for a zone that has no furniture yet.
 * @param {object} params
 */
export function pickVisionStarterPlacements({
  globalVision,
  room,
  zone,
  existingFurniture = [],
}) {
  const n = normalizeGuidedVisionFields(normalizeGlobalVision(globalVision));
  const bounds = getZoneBoundsInches(zone);
  if (!bounds || !room) return [];

  const inZone = existingFurniture.filter((f) => itemInZone(f, zone));
  if (inZone.length > 0) return [];

  const styleHint = deriveStyleHintFromVision(globalVision);
  const zoneRoom = {
    width: bounds.width,
    depth: bounds.depth,
    height: room.height || 96,
  };

  const needLabels = Object.values(n.roomSpecificNeeds || {}).flat();
  const categories = new Set();
  for (const label of needLabels) {
    const cat = ROOM_NEED_TO_CATEGORY[String(label).toLowerCase()];
    if (cat) categories.add(cat);
  }
  if (categories.size === 0) {
    if (n.priorities.some((p) => /host/i.test(p))) categories.add('seating');
    if (n.priorities.some((p) => /storage/i.test(p))) categories.add('storage');
    if (categories.size === 0) categories.add('seating');
  }

  const placements = [];
  const cx = bounds.left + bounds.width / 2;
  const cy = bounds.top + bounds.height / 2;

  for (const category of [...categories].slice(0, 2)) {
    const result = recommendForRoom({
      room: zoneRoom,
      placements: inZone,
      catalog: STARTER_FURNITURE_CATALOG,
      category,
      options: { styleHint: styleHint || undefined, maxResults: 1, perCategoryMax: 1 },
    });
    const entry = result?.items?.[0];
    if (!entry?.item) continue;
    const offset = placements.length * 36;
    placements.push(
      createPlacedFurnitureFromCatalogItem(
        entry.item,
        { x_inches: cx + offset, y_inches: cy },
        { center: true },
      ),
    );
  }

  return placements.map((p) => ({ ...p, zone_id: zone.id }));
}

/**
 * Apply vision to room interior + optional starter furniture (idempotent per revision).
 * @param {{
 *   globalVision: object,
 *   room: object,
 *   zones: object[],
 *   furniture: object[],
 *   activeZone: object | null,
 *   updateRoomInterior: (patch: object) => Promise<unknown>,
 *   addFurniture: (item: object) => Promise<unknown>,
 *   setRecommendedItems?: (items: object[]) => void,
 * }} params
 */
export async function applyVisionDesignToEditor({
  globalVision,
  room,
  zones,
  furniture,
  activeZone,
  updateRoomInterior,
  addFurniture,
  setRecommendedItems,
}) {
  if (!room || !globalVision) return { applied: false };

  const revision = computeVisionDesignRevision(globalVision);
  const currentInterior = room.interior || {};
  if (currentInterior.visionRevision !== revision) {
    const nextInterior = deriveInteriorFromVision(globalVision, currentInterior);
    await updateRoomInterior(nextInterior);
  }

  const styleHint = deriveStyleHintFromVision(globalVision);
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
      options: { styleHint: styleHint || undefined, maxResults: 5 },
    });
    setRecommendedItems(rec?.items?.map((e) => e.item) || []);
  }

  let added = 0;
  const placementsRevision = currentInterior.visionPlacementsRevision;
  if (placementsRevision !== revision) {
    const targets = activeZone ? [activeZone] : zones.slice(0, 3);
    for (const z of targets) {
      const starters = pickVisionStarterPlacements({
        globalVision,
        room,
        zone: z,
        existingFurniture: furniture,
      });
      for (const placement of starters) {
        // eslint-disable-next-line no-await-in-loop
        await addFurniture(placement);
        added += 1;
      }
    }
    if (added > 0) {
      await updateRoomInterior({
        ...deriveInteriorFromVision(globalVision, room.interior),
        visionPlacementsRevision: revision,
      });
    }
  }

  return { applied: true, revision, placementsAdded: added, styleHint };
}
