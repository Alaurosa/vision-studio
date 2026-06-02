/**
 * Pure, framework-free helpers for 3D camera navigation (Sprint 4, US3).
 *
 * Covers the math behind:
 *   - smooth-control distance bounds + default/reset pose (3.1),
 *   - keeping the camera above the floor and out of furniture solids (3.2),
 *   - projecting the world to the top-down minimap overlay (3.3).
 *
 * No React or three.js imports here on purpose — every export is a plain
 * function so the navigation math is unit-testable in node/jsdom (3.4).
 *
 * Units: the 3D world (RoomViewer3D) is in METERS, with the room's near
 * corner at the origin (+x = width, +z = depth, +y = up). Room and furniture
 * source data are in INCHES, converted with INCHES_TO_METERS. Camera positions
 * passed in here are already in world meters.
 */
import {
  INCHES_TO_METERS,
  getFurnitureRenderDimensionsInches,
} from './furniture3d';
import { getRotatedBoundingBox, normalizeRotation } from './scale';

export const IN_TO_M = INCHES_TO_METERS;

/** Defaults mirror RoomViewer3D's `room?.width || 180` style fallbacks. */
const DEFAULT_ROOM_IN = Object.freeze({ width: 180, depth: 144, height: 96 });

export function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Room inches → world-meter dimensions.
 * @returns {{ w: number, d: number, h: number }}
 */
export function roomDimensionsMeters(room) {
  const widthIn = room?.width || DEFAULT_ROOM_IN.width;
  const depthIn = room?.depth || DEFAULT_ROOM_IN.depth;
  const heightIn = room?.height || DEFAULT_ROOM_IN.height;
  return {
    w: widthIn * IN_TO_M,
    d: depthIn * IN_TO_M,
    h: heightIn * IN_TO_M,
  };
}

/**
 * Axis-aligned furniture footprint boxes in world meters. Each box uses the
 * rotation-expanded bounding box (matching how RoomViewer3D places items) and
 * sits on the floor, spanning y ∈ [0, topY].
 *
 * @param {Array<object>} furniture
 * @returns {Array<{id, category, color, name, rotation, minX, maxX, minZ, maxZ, topY, cx, cz}>}
 */
export function furnitureBoxesMeters(furniture = []) {
  const boxes = [];
  for (const item of furniture) {
    if (!item || typeof item !== 'object') continue;
    const dims = getFurnitureRenderDimensionsInches(item);
    const bbox = getRotatedBoundingBox(dims.width, dims.depth, item.rotation || 0);
    const minXin = item.x_inches || 0;
    const minZin = item.y_inches || 0;
    boxes.push({
      id: item.id ?? null,
      category: item.category ?? null,
      color: item.color ?? null,
      name: item.name ?? null,
      rotation: item.rotation || 0,
      minX: minXin * IN_TO_M,
      maxX: (minXin + bbox.width) * IN_TO_M,
      minZ: minZin * IN_TO_M,
      maxZ: (minZin + bbox.depth) * IN_TO_M,
      topY: dims.height * IN_TO_M,
      cx: (minXin + bbox.width / 2) * IN_TO_M,
      cz: (minZin + bbox.depth / 2) * IN_TO_M,
    });
  }
  return boxes;
}

/**
 * True rotated footprint corners (world meters) for nicer minimap rendering.
 * Returns four {x, z} corners in local order TL, TR, BR, BL rotated about the
 * item's center.
 */
export function furnitureFootprintCorners(item) {
  const dims = getFurnitureRenderDimensionsInches(item);
  const bbox = getRotatedBoundingBox(dims.width, dims.depth, item.rotation || 0);
  const cx = ((item.x_inches || 0) + bbox.width / 2) * IN_TO_M;
  const cz = ((item.y_inches || 0) + bbox.depth / 2) * IN_TO_M;
  const hw = (dims.width / 2) * IN_TO_M;
  const hd = (dims.depth / 2) * IN_TO_M;
  const angle = (normalizeRotation(item.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([lx, lz]) => ({
    x: cx + lx * cos - lz * sin,
    z: cz + lx * sin + lz * cos,
  }));
}

/**
 * Single collision-resolution pass: lift above the floor, then push the point
 * out of any furniture box it has entered (along the axis of least
 * penetration, including up-and-over the top).
 */
function collisionPass(point, boxes, floorClearance, padding) {
  let { x, y, z } = point;
  let hit = false;

  if (y < floorClearance) {
    y = floorClearance;
    hit = true;
  }

  for (const box of boxes) {
    const minX = box.minX - padding;
    const maxX = box.maxX + padding;
    const minZ = box.minZ - padding;
    const maxZ = box.maxZ + padding;
    const top = box.topY + padding;
    const inside = x > minX && x < maxX && z > minZ && z < maxZ && y < top;
    if (!inside) continue;

    // Distance to escape across each face (all non-negative inside the box).
    const outLeft = x - minX;
    const outRight = maxX - x;
    const outNear = z - minZ;
    const outFar = maxZ - z;
    const outTop = top - y;
    const least = Math.min(outLeft, outRight, outNear, outFar, outTop);

    if (least === outTop) y = top;
    else if (least === outLeft) x = minX;
    else if (least === outRight) x = maxX;
    else if (least === outNear) z = minZ;
    else z = maxZ;
    hit = true;
  }

  return { x, y, z, hit };
}

/**
 * Resolve camera collisions so it cannot drop below the floor or sit inside a
 * furniture solid (Sprint 4, 3.2). Runs a few passes so a point wedged between
 * neighbouring items still resolves to a collision-free spot.
 *
 * @param {{x:number,y:number,z:number}} position  desired camera position (meters)
 * @param {{ boxes?: Array, floorClearance?: number, padding?: number, iterations?: number }} opts
 * @returns {{ x:number, y:number, z:number, collided:boolean }}
 *   `collided` reflects whether the *requested* position needed correction.
 */
export function resolveCameraCollision(position, opts = {}) {
  const {
    boxes = [],
    floorClearance = 0.12,
    padding = 0.06,
    iterations = 4,
  } = opts;

  let current = { x: position.x, y: position.y, z: position.z };
  const first = collisionPass(current, boxes, floorClearance, padding);
  current = { x: first.x, y: first.y, z: first.z };

  let pass = first;
  let i = 1;
  while (pass.hit && i < iterations) {
    pass = collisionPass(current, boxes, floorClearance, padding);
    current = { x: pass.x, y: pass.y, z: pass.z };
    if (!pass.hit) break;
    i += 1;
  }

  return { x: current.x, y: current.y, z: current.z, collided: first.hit };
}

/**
 * Keep the orbit target inside the room footprint and at a sane height so the
 * view stays focused on the room as the user pans (3.1/3.2).
 */
export function clampTargetToRoom(target, room, margin = 0) {
  const { w, d, h } = roomDimensionsMeters(room);
  return {
    x: clamp(target.x, margin, Math.max(margin, w - margin)),
    y: clamp(target.y, 0.1, h),
    z: clamp(target.z, margin, Math.max(margin, d - margin)),
  };
}

/**
 * Zoom (dolly) distance bounds scaled to room size, so small rooms don't let
 * you zoom to the far side and huge rooms aren't capped too tight (3.1, and
 * the "different room sizes" usability axis of 3.4).
 */
export function cameraDistanceBounds(room) {
  const { w, d, h } = roomDimensionsMeters(room);
  const span = Math.max(w, d, h);
  return {
    min: Math.max(0.4, span * 0.12),
    max: Math.max(2, span * 3.5),
  };
}

/**
 * Default ("home") camera pose for a room — also the reset-view target.
 * Mirrors RoomViewer3D's original framing.
 */
export function defaultCameraPose(room) {
  const { w, d, h } = roomDimensionsMeters(room);
  return {
    position: { x: w * 1.1, y: h * 1.3, z: d * 1.4 },
    target: { x: w / 2, y: h / 3, z: d / 2 },
  };
}

/**
 * Camera heading in the XZ plane (radians): the direction from the camera
 * toward its look target. 0 = +x, increasing toward +z. Used to draw the
 * minimap view cone.
 */
export function cameraFacingRad(cameraPos, target) {
  return Math.atan2(target.z - cameraPos.z, target.x - cameraPos.x);
}

/**
 * Geometry for fitting a room into a minimap of `width`×`height` pixels,
 * preserving aspect ratio and centering it within `padding`.
 * @returns projection descriptor consumed by {@link worldToMinimap}.
 */
export function minimapProjection(room, { width, height, padding = 8 }) {
  const { w, d } = roomDimensionsMeters(room);
  const availW = Math.max(1, width - padding * 2);
  const availH = Math.max(1, height - padding * 2);
  const scale = Math.min(availW / (w || 1), availH / (d || 1));
  const roomPxW = w * scale;
  const roomPxH = d * scale;
  return {
    scale,
    originX: padding + (availW - roomPxW) / 2,
    originY: padding + (availH - roomPxH) / 2,
    roomPxW,
    roomPxH,
    width,
    height,
    padding,
    w,
    d,
  };
}

/** World meters (x, z) → minimap pixel (x, y). */
export function worldToMinimap(xMeters, zMeters, projection) {
  return {
    x: projection.originX + xMeters * projection.scale,
    y: projection.originY + zMeters * projection.scale,
  };
}

/** Is a world-meter (x, z) point inside the room footprint? */
export function isInsideRoomFootprint(xMeters, zMeters, room, margin = 0) {
  const { w, d } = roomDimensionsMeters(room);
  return (
    xMeters >= -margin &&
    xMeters <= w + margin &&
    zMeters >= -margin &&
    zMeters <= d + margin
  );
}
