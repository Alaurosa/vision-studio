import { GRID_SNAP_INCHES } from '@/utils/constants';
import { snapToGrid } from '@/utils/scale';

export const MIN_ROOM_DIM_IN = 24;
export const POINT_EPS = 0.75;

export function segmentLengthInches(seg) {
  if (!seg?.start || !seg?.end) return 0;
  const dx = seg.end[0] - seg.start[0];
  const dy = seg.end[1] - seg.start[1];
  return Math.hypot(dx, dy);
}

export function pointsNear(a, b, eps = POINT_EPS) {
  if (!a || !b) return false;
  return Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps;
}

export function clampWallPoint(pt, roomWidth, roomDepth) {
  const maxX = Math.max(MIN_ROOM_DIM_IN, Number(roomWidth) || MIN_ROOM_DIM_IN);
  const maxY = Math.max(MIN_ROOM_DIM_IN, Number(roomDepth) || MIN_ROOM_DIM_IN);
  return [
    Math.min(maxX, Math.max(0, pt[0])),
    Math.min(maxY, Math.max(0, pt[1])),
  ];
}

/**
 * Move every segment endpoint matching `from` to snapped/clamped `to`.
 */
export function moveWallJoint(walls, from, to, roomWidth, roomDepth) {
  if (!Array.isArray(walls)) return walls;
  const snapped = [
    snapToGrid(to[0], GRID_SNAP_INCHES),
    snapToGrid(to[1], GRID_SNAP_INCHES),
  ];
  const target = clampWallPoint(snapped, roomWidth, roomDepth);
  return walls.map((s) => {
    const start = [...s.start];
    const end = [...s.end];
    if (pointsNear(start, from)) {
      start[0] = target[0];
      start[1] = target[1];
    }
    if (pointsNear(end, from)) {
      end[0] = target[0];
      end[1] = target[1];
    }
    return { start, end };
  });
}

export function isSegmentWallsFormat(walls) {
  const first = walls?.[0];
  return (
    Array.isArray(walls) &&
    walls.length > 0 &&
    Array.isArray(first?.start) &&
    first.start.length === 2 &&
    Array.isArray(first?.end) &&
    first.end.length === 2
  );
}

/** Floorplan polygon from image space: [[x,y], [x,y], …] — not editable as segment joints here. */
export function isPolygonWallsFormat(walls) {
  const first = walls?.[0];
  return (
    Array.isArray(walls) &&
    walls.length >= 3 &&
    Array.isArray(first) &&
    first.length === 2 &&
    typeof first[0] === 'number' &&
    typeof first[1] === 'number'
  );
}

/** Axis-aligned room perimeter in inch segments (room origin = corner). */
export function roomRectangleOutline(width, depth) {
  const w = Math.max(MIN_ROOM_DIM_IN, Number(width) || MIN_ROOM_DIM_IN);
  const d = Math.max(MIN_ROOM_DIM_IN, Number(depth) || MIN_ROOM_DIM_IN);
  return [
    { start: [0, 0], end: [w, 0] },
    { start: [w, 0], end: [w, d] },
    { start: [w, d], end: [0, d] },
    { start: [0, d], end: [0, 0] },
  ];
}

/**
 * Scale segment endpoints from a saved room box to a new width/depth (inch space).
 * Used while resizing floor so outlines and dimension labels track the preview box.
 */
export function scaleSegmentWallsToRoomBox(walls, baseWidth, baseDepth, targetWidth, targetDepth) {
  if (!isSegmentWallsFormat(walls)) return walls;
  const bw = Math.max(MIN_ROOM_DIM_IN, Number(baseWidth) || MIN_ROOM_DIM_IN);
  const bd = Math.max(MIN_ROOM_DIM_IN, Number(baseDepth) || MIN_ROOM_DIM_IN);
  const tw = Math.max(MIN_ROOM_DIM_IN, Number(targetWidth) || MIN_ROOM_DIM_IN);
  const td = Math.max(MIN_ROOM_DIM_IN, Number(targetDepth) || MIN_ROOM_DIM_IN);
  const sx = tw / bw;
  const sy = td / bd;
  return walls.map((s) => ({
    start: [s.start[0] * sx, s.start[1] * sy],
    end: [s.end[0] * sx, s.end[1] * sy],
  }));
}
