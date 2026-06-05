/**
 * Apply Space Assistant furniture mutations into the active zone.
 */

import { furnitureBelongsToZoneId } from '@/store/layoutStore';

/**
 * @param {import('@/store/layoutStore').default extends never ? object : ReturnType<typeof import('@/store/layoutStore').useLayoutStore.getState>} store
 * @param {object} rawItem
 * @param {{ animDelay?: number }} [opts]
 */
export function addAssistantFurniture(store, rawItem, opts = {}) {
  const zoneId = store.activeZoneId || rawItem.zone_id || null;
  const w = Number(rawItem.width) || 24;
  const d = Number(rawItem.depth) || 24;
  const slot = store.findOpenSlot(w, d);
  store.addFurniture({
    name: rawItem.name,
    category: rawItem.category,
    provider: rawItem.provider,
    catalog_id: rawItem.catalog_id || rawItem.id || null,
    width: rawItem.width,
    depth: rawItem.depth,
    height: rawItem.height,
    x_inches: rawItem.x_inches ?? slot.x,
    y_inches: rawItem.y_inches ?? slot.y,
    rotation: rawItem.rotation ?? 0,
    color: rawItem.color || '#d4a27a',
    image_url: rawItem.image_url,
    model_url: rawItem.model_url,
    zone_id: zoneId,
    _animDelay: opts.animDelay ?? 300,
  });
}

/**
 * @param {object[]} furniture
 * @param {string | null} activeZoneId
 * @param {object[]} zones
 */
export function placementsForActiveZone(furniture, activeZoneId, zones) {
  if (!activeZoneId) return furniture;
  return furniture.filter((f) => furnitureBelongsToZoneId(f, activeZoneId, zones));
}
