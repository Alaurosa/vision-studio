/**
 * Zone-scoped placement helpers for chat tools (active editor space / sub-room).
 */

const GRID_STEP = 6;

/**
 * @param {object | null | undefined} zone
 */
export function getZoneBounds(zone) {
  if (!zone) return null;
  if (Array.isArray(zone.bbox) && zone.bbox.length === 4) {
    const [left, top, right, bottom] = zone.bbox.map((v) => Number(v) || 0);
    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(1, right - left),
      depth: Math.max(1, bottom - top),
    };
  }
  if (Array.isArray(zone.polygon) && zone.polygon.length > 0) {
    const xs = zone.polygon.map((pt) => (Array.isArray(pt) ? pt[0] : pt?.x) ?? 0);
    const ys = zone.polygon.map((pt) => (Array.isArray(pt) ? pt[1] : pt?.y) ?? 0);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const right = Math.max(...xs);
    const bottom = Math.max(...ys);
    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(1, right - left),
      depth: Math.max(1, bottom - top),
    };
  }
  const width = Number(zone.width) || 0;
  const depth = Number(zone.depth) || 0;
  if (width > 0 && depth > 0) {
    return { left: 0, top: 0, right: width, bottom: depth, width, depth };
  }
  return null;
}

/**
 * @param {object} room
 * @param {string | null | undefined} zoneId
 */
/**
 * @param {object} room
 * @param {string | null | undefined} zoneId
 * @param {object | null | undefined} zoneContextPayload
 */
export function buildZoneContext(room, zoneId, zoneContextPayload) {
  if (!zoneId) return null;
  const fromRoom = resolveZoneContext(room, zoneId);
  if (fromRoom?.bounds) return fromRoom;
  if (zoneContextPayload && typeof zoneContextPayload === 'object') {
    const bounds = getZoneBounds(zoneContextPayload);
    if (bounds) {
      return {
        id: zoneId,
        name: zoneContextPayload.name || fromRoom?.name || 'Space',
        bounds,
        zone: zoneContextPayload,
      };
    }
  }
  return fromRoom || (zoneId ? { id: zoneId, name: 'Space', bounds: null, zone: null } : null);
}

/**
 * @param {object} room
 * @param {string | null | undefined} zoneId
 */
export function resolveZoneContext(room, zoneId) {
  if (!zoneId || !room) return null;
  const zones = Array.isArray(room.zones) ? room.zones : [];
  const zone = zones.find((z) => z.id === zoneId);
  if (!zone) return null;
  const bounds = getZoneBounds(zone);
  if (!bounds) return { id: zoneId, name: zone.name || 'Space', bounds: null, zone };
  return { id: zoneId, name: zone.name || 'Space', bounds, zone };
}

/**
 * @param {object} placement
 * @param {object | null} zoneContext
 */
export function placementBelongsToZone(placement, zoneContext) {
  if (!zoneContext?.id) return true;
  if (placement.zone_id && zoneContext.id) {
    return placement.zone_id === zoneContext.id;
  }
  const b = zoneContext.bounds;
  if (!b) return true;
  const cx = (Number(placement.x_inches) || 0) + (Number(placement.width) || 0) / 2;
  const cy = (Number(placement.y_inches) || 0) + (Number(placement.depth) || 0) / 2;
  return cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom;
}

/**
 * @param {object[]} placements
 * @param {object | null} zoneContext
 */
export function filterPlacementsForZone(placements, zoneContext) {
  if (!zoneContext?.id) return placements;
  return placements.filter((p) => placementBelongsToZone(p, zoneContext));
}

function snap(n) {
  return Math.round(n / GRID_STEP) * GRID_STEP;
}

/**
 * @param {object[]} placements - already zone-scoped
 * @param {number} w
 * @param {number} d
 * @param {object | null} zoneContext
 * @param {object} room
 */
export function findOpenSlotInZone(placements, w, d, zoneContext, room) {
  const bounds = zoneContext?.bounds || {
    left: 0,
    top: 0,
    right: Number(room?.width) || 120,
    bottom: Number(room?.depth) || 120,
    width: Number(room?.width) || 120,
    depth: Number(room?.depth) || 120,
  };
  const minX = Math.max(GRID_STEP, snap(bounds.left));
  const minY = Math.max(GRID_STEP, snap(bounds.top));
  const maxX = Math.min(Number(room?.width) || bounds.right, bounds.right);
  const maxY = Math.min(Number(room?.depth) || bounds.bottom, bounds.bottom);

  const overlaps = (box, other) =>
    !(
      box.right <= other.left ||
      box.left >= other.right ||
      box.bottom <= other.top ||
      box.top >= other.bottom
    );

  for (let y = minY; y + d <= maxY; y += GRID_STEP) {
    for (let x = minX; x + w <= maxX; x += GRID_STEP) {
      const box = { left: x, top: y, right: x + w, bottom: y + d };
      const clash = placements.some((p) => {
        const pw = Number(p.width) || 24;
        const pd = Number(p.depth) || 24;
        const other = {
          left: Number(p.x_inches) || 0,
          top: Number(p.y_inches) || 0,
          right: (Number(p.x_inches) || 0) + pw,
          bottom: (Number(p.y_inches) || 0) + pd,
        };
        return overlaps(box, other);
      });
      if (!clash) return { x: snap(x), y: snap(y) };
    }
  }
  return { x: minX, y: minY };
}

/**
 * @param {{ x_inches: number, y_inches: number }} pos
 * @param {object | null} zoneContext
 */
export function globalizeLayoutPosition(pos, zoneContext) {
  if (!zoneContext?.bounds) return pos;
  return {
    ...pos,
    x_inches: pos.x_inches + zoneContext.bounds.left,
    y_inches: pos.y_inches + zoneContext.bounds.top,
  };
}

/**
 * @param {object | null} zoneContext
 * @param {object} room
 */
export function layoutRoomForZone(zoneContext, room) {
  if (zoneContext?.bounds) {
    return { width: zoneContext.bounds.width, depth: zoneContext.bounds.depth };
  }
  return { width: Number(room?.width) || 120, depth: Number(room?.depth) || 120 };
}
