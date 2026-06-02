import { describe, it, expect } from 'vitest';
import {
  IN_TO_M,
  roomDimensionsMeters,
  furnitureBoxesMeters,
  furnitureFootprintCorners,
  resolveCameraCollision,
  clampTargetToRoom,
  cameraDistanceBounds,
  defaultCameraPose,
  cameraFacingRad,
  minimapProjection,
  worldToMinimap,
  isInsideRoomFootprint,
} from '@/utils/cameraNav';

// Camera-navigation math (Sprint 4, US3 · 3.4). These cover the pure helpers
// behind smooth controls (distance bounds / reset pose), collision (floor +
// furniture push-out), and the minimap projection — exercised across a range
// of room sizes and furniture densities, which is exactly the usability axis
// the story calls for.

const item = ({ id = 'a', x = 0, y = 0, w = 24, d = 24, h = 30, rot = 0, ...rest }) => ({
  id,
  x_inches: x,
  y_inches: y,
  width: w,
  depth: d,
  height: h,
  rotation: rot,
  ...rest,
});

function strictlyInsideAnyBox(p, boxes, padding = 0) {
  return boxes.some(
    (b) =>
      p.x > b.minX - padding &&
      p.x < b.maxX + padding &&
      p.z > b.minZ - padding &&
      p.z < b.maxZ + padding &&
      p.y < b.topY + padding,
  );
}

describe('roomDimensionsMeters', () => {
  it('falls back to sensible defaults when room is missing', () => {
    const { w, d, h } = roomDimensionsMeters(null);
    expect(w).toBeCloseTo(180 * IN_TO_M, 6);
    expect(d).toBeCloseTo(144 * IN_TO_M, 6);
    expect(h).toBeCloseTo(96 * IN_TO_M, 6);
  });

  it('converts inches to meters', () => {
    const { w, d, h } = roomDimensionsMeters({ width: 120, depth: 96, height: 108 });
    expect(w).toBeCloseTo(3.048, 4);
    expect(d).toBeCloseTo(2.4384, 4);
    expect(h).toBeCloseTo(2.7432, 4);
  });
});

describe('furnitureBoxesMeters', () => {
  it('builds floor-standing AABBs in meters', () => {
    const [box] = furnitureBoxesMeters([item({ x: 0, y: 0, w: 24, d: 24, h: 30 })]);
    expect(box.minX).toBeCloseTo(0, 6);
    expect(box.maxX).toBeCloseTo(24 * IN_TO_M, 6);
    expect(box.minZ).toBeCloseTo(0, 6);
    expect(box.maxZ).toBeCloseTo(24 * IN_TO_M, 6);
    expect(box.topY).toBeCloseTo(30 * IN_TO_M, 6);
    expect(box.cx).toBeCloseTo(12 * IN_TO_M, 6);
    expect(box.cz).toBeCloseTo(12 * IN_TO_M, 6);
  });

  it('expands the footprint for rotated items', () => {
    // 36×18 rotated 90° → footprint becomes 18 (x) by 36 (z).
    const [box] = furnitureBoxesMeters([item({ w: 36, d: 18, rot: 90 })]);
    expect(box.maxX - box.minX).toBeCloseTo(18 * IN_TO_M, 5);
    expect(box.maxZ - box.minZ).toBeCloseTo(36 * IN_TO_M, 5);
  });

  it('skips null entries and applies dimension fallbacks', () => {
    const boxes = furnitureBoxesMeters([null, item({ w: undefined, d: undefined, h: undefined })]);
    expect(boxes).toHaveLength(1);
    // default dims 24×24×30
    expect(boxes[0].maxX - boxes[0].minX).toBeCloseTo(24 * IN_TO_M, 6);
    expect(boxes[0].topY).toBeCloseTo(30 * IN_TO_M, 6);
  });
});

describe('resolveCameraCollision', () => {
  it('lifts the camera above the floor', () => {
    const r = resolveCameraCollision({ x: 1, y: 0.02, z: 1 }, { boxes: [] });
    expect(r.y).toBeCloseTo(0.12, 6);
    expect(r.collided).toBe(true);
  });

  it('leaves a free camera untouched', () => {
    const r = resolveCameraCollision({ x: 1, y: 1, z: 1 }, { boxes: [] });
    expect(r).toMatchObject({ x: 1, y: 1, z: 1, collided: false });
  });

  it('pushes the camera out the nearest side of a furniture box', () => {
    const boxes = furnitureBoxesMeters([item({ x: 0, y: 0, w: 24, d: 24, h: 30 })]);
    // Near the left face, deep inside vertically → least penetration is -x.
    const r = resolveCameraCollision(
      { x: 0.05, y: 0.1, z: 0.3 },
      { boxes, floorClearance: 0, padding: 0 },
    );
    expect(r.collided).toBe(true);
    expect(r.x).toBeCloseTo(0, 6);
    expect(strictlyInsideAnyBox(r, boxes)).toBe(false);
  });

  it('pushes the camera up over the top when that is closest', () => {
    const boxes = furnitureBoxesMeters([item({ x: 0, y: 0, w: 24, d: 24, h: 30 })]);
    const top = 30 * IN_TO_M;
    const r = resolveCameraCollision(
      { x: 0.3, y: top - 0.02, z: 0.3 },
      { boxes, floorClearance: 0, padding: 0 },
    );
    expect(r.y).toBeCloseTo(top, 6);
  });

  it('does not treat a camera above the furniture top as a collision', () => {
    const boxes = furnitureBoxesMeters([item({ h: 30 })]);
    const r = resolveCameraCollision({ x: 0.3, y: 1.5, z: 0.3 }, { boxes, padding: 0 });
    expect(r.collided).toBe(false);
  });

  it('resolves a camera wedged between adjacent items (dense layout)', () => {
    const boxes = furnitureBoxesMeters([
      item({ id: 'a', x: 0, y: 0, w: 24, d: 24 }),
      item({ id: 'b', x: 24, y: 0, w: 24, d: 24 }),
    ]);
    const r = resolveCameraCollision(
      { x: 23 * IN_TO_M, y: 0.1, z: 0.3 },
      { boxes, floorClearance: 0, padding: 0 },
    );
    expect(strictlyInsideAnyBox(r, boxes)).toBe(false);
  });

  // Lay out up to `maxCount` non-overlapping items on a grid that fits the
  // room (the real app never produces overlapping furniture — that's the S3-3
  // collision guarantee — so the camera resolver only ever sees separated
  // solids).
  const placeNonOverlapping = (room, maxCount) => {
    const items = [];
    const step = 48; // inches: comfortably larger than the 30in item span
    let i = 0;
    for (let gx = 0; gx + 36 <= room.width; gx += step) {
      for (let gy = 0; gy + 36 <= room.depth; gy += step) {
        if (i >= maxCount) return items;
        items.push(item({ id: `f${i}`, x: gx, y: gy, w: 30, d: 18, rot: (i % 2) * 90 }));
        i += 1;
      }
    }
    return items;
  };

  it('keeps the camera valid across varied room sizes and furniture densities', () => {
    const rooms = [
      { width: 60, depth: 60, height: 84 },
      { width: 180, depth: 144, height: 96 },
      { width: 480, depth: 360, height: 120 },
    ];
    for (const room of rooms) {
      const { w, d } = roomDimensionsMeters(room);
      for (const density of [1, 8, 20]) {
        const boxes = furnitureBoxesMeters(placeNonOverlapping(room, density));
        // Probe a grid of camera positions, including low/under-floor ones.
        for (let gx = 0; gx <= 4; gx++) {
          for (let gz = 0; gz <= 4; gz++) {
            const probe = { x: (w * gx) / 4, y: 0.03, z: (d * gz) / 4 };
            const r = resolveCameraCollision(probe, { boxes });
            expect(r.y).toBeGreaterThanOrEqual(0.12 - 1e-9);
            expect(strictlyInsideAnyBox(r, boxes)).toBe(false);
          }
        }
      }
    }
  });
});

describe('clampTargetToRoom', () => {
  it('clamps the orbit target into the room footprint and height band', () => {
    const room = { width: 120, depth: 120, height: 96 };
    const { w, d, h } = roomDimensionsMeters(room);
    const t = clampTargetToRoom({ x: -2, y: 99, z: 50 }, room);
    expect(t.x).toBeCloseTo(0, 6);
    expect(t.y).toBeCloseTo(h, 6);
    expect(t.z).toBeCloseTo(d, 6);
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(t.x).toBeLessThanOrEqual(w);
  });

  it('passes through a target already inside', () => {
    const room = { width: 200, depth: 200, height: 100 };
    const inside = { x: 1, y: 1, z: 1 };
    expect(clampTargetToRoom(inside, room)).toMatchObject(inside);
  });
});

describe('cameraDistanceBounds', () => {
  it('scales zoom range with room size and keeps min ≤ max', () => {
    const small = cameraDistanceBounds({ width: 48, depth: 48, height: 48 });
    const large = cameraDistanceBounds({ width: 600, depth: 400, height: 120 });
    expect(small.min).toBeGreaterThanOrEqual(0.4);
    expect(small.min).toBeLessThan(small.max);
    expect(large.max).toBeGreaterThan(small.max);
  });
});

describe('defaultCameraPose', () => {
  it('frames the room from outside, looking at its center', () => {
    const room = { width: 180, depth: 144, height: 96 };
    const { w, d } = roomDimensionsMeters(room);
    const { position, target } = defaultCameraPose(room);
    expect(position.x).toBeGreaterThan(w); // pulled back outside the footprint
    expect(position.y).toBeGreaterThan(0);
    expect(target.x).toBeCloseTo(w / 2, 6);
    expect(target.z).toBeCloseTo(d / 2, 6);
  });
});

describe('cameraFacingRad', () => {
  it('reports the XZ heading from camera toward target', () => {
    expect(cameraFacingRad({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBeCloseTo(0, 6);
    expect(cameraFacingRad({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })).toBeCloseTo(Math.PI / 2, 6);
    expect(cameraFacingRad({ x: 2, y: 5, z: 2 }, { x: 1, y: 0, z: 2 })).toBeCloseTo(Math.PI, 6);
  });
});

describe('minimap projection', () => {
  const SIZE = { width: 172, height: 136, padding: 12 };

  it('maps room corners to the padded panel area', () => {
    const room = { width: 120, depth: 120 };
    const proj = minimapProjection(room, SIZE);
    const tl = worldToMinimap(0, 0, proj);
    const br = worldToMinimap(roomDimensionsMeters(room).w, roomDimensionsMeters(room).d, proj);
    expect(tl.x).toBeCloseTo(proj.originX, 6);
    expect(tl.y).toBeCloseTo(proj.originY, 6);
    expect(br.x).toBeCloseTo(proj.originX + proj.roomPxW, 6);
    expect(br.y).toBeCloseTo(proj.originY + proj.roomPxH, 6);
    // Fits within the panel padding on every side.
    for (const p of [tl, br]) {
      expect(p.x).toBeGreaterThanOrEqual(SIZE.padding - 1e-9);
      expect(p.x).toBeLessThanOrEqual(SIZE.width - SIZE.padding + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(SIZE.padding - 1e-9);
      expect(p.y).toBeLessThanOrEqual(SIZE.height - SIZE.padding + 1e-9);
    }
  });

  it('preserves aspect ratio (wide room is width-constrained)', () => {
    const proj = minimapProjection({ width: 240, depth: 60 }, SIZE);
    const availW = SIZE.width - SIZE.padding * 2;
    expect(proj.roomPxW).toBeCloseTo(availW, 4);
    expect(proj.roomPxH).toBeLessThan(SIZE.height - SIZE.padding * 2);
  });

  it('preserves aspect ratio (tall room is height-constrained)', () => {
    const proj = minimapProjection({ width: 60, depth: 240 }, SIZE);
    const availH = SIZE.height - SIZE.padding * 2;
    expect(proj.roomPxH).toBeCloseTo(availH, 4);
    expect(proj.roomPxW).toBeLessThan(SIZE.width - SIZE.padding * 2);
  });

  it('produces a larger scale for a smaller room', () => {
    const small = minimapProjection({ width: 60, depth: 60 }, SIZE);
    const large = minimapProjection({ width: 600, depth: 600 }, SIZE);
    expect(small.scale).toBeGreaterThan(large.scale);
  });
});

describe('furnitureFootprintCorners', () => {
  it('returns the AABB corners around the item center when unrotated', () => {
    const corners = furnitureFootprintCorners(item({ x: 0, y: 0, w: 24, d: 24, rot: 0 }));
    expect(corners).toHaveLength(4);
    expect(corners[0].x).toBeCloseTo(0, 6);
    expect(corners[0].z).toBeCloseTo(0, 6);
    const cx = corners.reduce((s, c) => s + c.x, 0) / 4;
    const cz = corners.reduce((s, c) => s + c.z, 0) / 4;
    expect(cx).toBeCloseTo(12 * IN_TO_M, 6);
    expect(cz).toBeCloseTo(12 * IN_TO_M, 6);
  });

  it('rotates the footprint (90° swaps the span)', () => {
    const corners = furnitureFootprintCorners(item({ x: 0, y: 0, w: 24, d: 12, rot: 90 }));
    const xs = corners.map((c) => c.x);
    const zs = corners.map((c) => c.z);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(12 * IN_TO_M, 5);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(24 * IN_TO_M, 5);
  });
});

describe('isInsideRoomFootprint', () => {
  it('detects inside/outside with an optional margin', () => {
    const room = { width: 120, depth: 120 };
    expect(isInsideRoomFootprint(1, 1, room)).toBe(true);
    expect(isInsideRoomFootprint(-0.1, 1, room)).toBe(false);
    expect(isInsideRoomFootprint(-0.1, 1, room, 0.2)).toBe(true);
    expect(isInsideRoomFootprint(99, 1, room)).toBe(false);
  });
});
