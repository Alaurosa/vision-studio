/**
 * Whole-floorplan 3D layout: space positions in meters + overview camera.
 */

import { projectFloorplanOverlays, toBboxArray, normalizeGeometry } from '@/utils/floorplanGeometry';
import { getZoneBoundsInches } from '@/utils/roomView3d';
import { INCHES_TO_METERS } from '@/utils/furniture3d';

export { INCHES_TO_METERS };

/**
 * @param {{ id: string, zoneId?: string, zone_id?: string, geometry?: object }} overlay
 * @param {object[]} zones
 * @param {object | null} project
 */
export function resolveZoneForProjectOverlay(overlay, zones = [], project = null) {
  const space = (project?.spaces || []).find((s) => s.id === overlay.id);
  const zid = space?.zoneId || space?.zone_id;
  if (zid) {
    const direct = zones.find((z) => z.id === zid);
    if (direct) return direct;
  }

  const [x1, y1, x2, y2] = toBboxArray(overlay.geometry);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  for (const zone of zones) {
    const b = getZoneBoundsInches(zone);
    if (!b) continue;
    if (cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom) {
      return zone;
    }
  }

  const floorZones = Array.isArray(project?.floorplan?.zones) ? project.floorplan.zones : [];
  if (zid) {
    const fz = floorZones.find((z) => z.id === zid);
    if (fz) {
      return zones.find((z) => z.id === fz.id) || {
        id: fz.id,
        name: fz.name,
        bbox: toBboxArray(fz.geometry || overlay.geometry),
      };
    }
  }

  return null;
}

/**
 * @param {object | null} project
 * @param {object[]} zones - layoutStore zones
 */
export function buildProject3dSpaces(project, zones = []) {
  const { overlays, bounds } = projectFloorplanOverlays(project);
  if (!overlays.length || !bounds) {
    return { spaces: [], worldW: 6, worldD: 6, worldH: 2.5 };
  }

  const spaces = overlays.map((overlay) => {
    const zone = resolveZoneForProjectOverlay(overlay, zones, project);
    const g = normalizeGeometry(overlay.geometry);
    const zoneBounds = zone ? getZoneBoundsInches(zone) : null;
    const leftIn = zoneBounds?.left ?? g.bbox.x;
    const topIn = zoneBounds?.top ?? g.bbox.y;
    const widthIn = zoneBounds?.width ?? g.bbox.width;
    const depthIn = zoneBounds?.depth ?? g.bbox.height;
    const heightIn = overlay.type === 'exterior' ? 42 : 96;

    return {
      id: overlay.id,
      name: overlay.name,
      type: overlay.type,
      zoneId: zone?.id || null,
      leftIn,
      topIn,
      widthIn,
      depthIn,
      heightIn,
    };
  });

  const worldW = Math.max(6, bounds.width * INCHES_TO_METERS);
  const worldD = Math.max(6, bounds.height * INCHES_TO_METERS);
  const worldH = Math.max(
    2.4,
    ...spaces.map((s) => s.heightIn * INCHES_TO_METERS),
  );

  return { spaces, worldW, worldD, worldH };
}

/**
 * Top-down / angled overview for full property (not block stack).
 * @param {{ worldW: number, worldD: number, worldH: number }} world
 */
export function getProjectOverviewCamera(world) {
  const { worldW, worldD, worldH } = world;
  const cx = worldW / 2;
  const cz = worldD / 2;
  const span = Math.max(worldW, worldD, 1);
  const dist = span * 1.15;
  return {
    position: [cx + dist * 0.35, dist * 0.95 + worldH * 0.15, cz + dist * 0.35],
    target: [cx, worldH * 0.38, cz],
    fov: 42,
  };
}
