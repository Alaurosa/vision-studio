/**
 * Room-scoped 3D view helpers (2D zones / project spaces → shell + local furniture coords).
 */

import { normalizeGeometry } from '@/utils/floorplanGeometry';
import { DEFAULT_ROOM_DIMENSIONS_INCHES } from '@/utils/roomShell3d';

/**
 * @param {object | null | undefined} zone
 * @returns {{ left: number, top: number, right: number, bottom: number, width: number, depth: number } | null}
 */
export function getZoneBoundsInches(zone) {
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
 * Resolve shell dimensions and origin for an individual room 3D view.
 * @param {object | null | undefined} room
 * @param {object | null | undefined} activeZone
 * @param {object | null | undefined} [spaceGeometry]
 */
export function getRoomViewContext(room, activeZone, spaceGeometry = null) {
  const fallbackW = DEFAULT_ROOM_DIMENSIONS_INCHES.width;
  const fallbackD = DEFAULT_ROOM_DIMENSIONS_INCHES.depth;
  const fallbackH = DEFAULT_ROOM_DIMENSIONS_INCHES.height;

  let originX = 0;
  let originY = 0;
  let widthIn = Number(room?.width) || fallbackW;
  let depthIn = Number(room?.depth) || fallbackD;
  const heightIn = Number(room?.height) || fallbackH;

  const zoneBounds = getZoneBoundsInches(activeZone);
  if (zoneBounds) {
    originX = zoneBounds.left;
    originY = zoneBounds.top;
    widthIn = zoneBounds.width;
    depthIn = zoneBounds.depth;
  } else if (spaceGeometry) {
    const g = normalizeGeometry(spaceGeometry);
    originX = g.bbox.x;
    originY = g.bbox.y;
    widthIn = Math.max(24, g.bbox.width);
    depthIn = Math.max(24, g.bbox.height);
  }

  const label = activeZone?.name || room?.name || null;

  return {
    widthIn,
    depthIn,
    heightIn,
    originX,
    originY,
    label,
    isZoneScoped: Boolean(zoneBounds || spaceGeometry),
  };
}

/**
 * @param {object} item - placement with x_inches, y_inches
 * @param {number} originX
 * @param {number} originY
 */
export function toLocalFurnitureInches(item, originX, originY) {
  return {
    x: (Number(item.x_inches) || 0) - originX,
    y: (Number(item.y_inches) || 0) - originY,
  };
}

/**
 * @param {object | null | undefined} room - for shell dimensions
 */
export function getRoomViewShellRoom(room, viewContext) {
  if (!viewContext?.isZoneScoped) return room;
  return {
    ...room,
    width: viewContext.widthIn,
    depth: viewContext.depthIn,
    height: viewContext.heightIn,
  };
}

/**
 * Resolve layoutStore zone id for a project space (zone link, centroid match, or floorplan zone).
 * @param {object[]} zones
 * @param {{ id?: string, zoneId?: string, zone_id?: string, geometry?: object, name?: string }} space
 * @param {object | null} [project]
 * @returns {string | null}
 */
export function resolveActiveZoneIdForSpace(zones, space, project = null) {
  if (!space) return null;
  const zid = space.zoneId || space.zone_id;
  if (zid && zones.some((z) => z.id === zid)) return zid;

  if (space.geometry) {
    const g = normalizeGeometry(space.geometry);
    const cx = g.bbox.x + g.bbox.width / 2;
    const cy = g.bbox.y + g.bbox.height / 2;
    const match = zones.find((z) => {
      const b = getZoneBoundsInches(z);
      return b && cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom;
    });
    if (match) return match.id;
  }

  const floorZones = Array.isArray(project?.floorplan?.zones) ? project.floorplan.zones : [];
  const fz = floorZones.find(
    (z) =>
      z.id === zid ||
      (space.name && String(z.name || '').toLowerCase() === String(space.name).toLowerCase()),
  );
  if (fz?.id && zones.some((z) => z.id === fz.id)) return fz.id;

  return null;
}
