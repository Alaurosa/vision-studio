import { describe, it, expect } from 'vitest';
import { getAABB, overlaps, withinRoom, validateAll } from '@/utils/collision';

// Helper to build a furniture item with sane defaults.
function item({ id = 'a', name = 'Item', x = 0, y = 0, width = 24, depth = 24, rotation = 0 } = {}) {
  return { id, name, x_inches: x, y_inches: y, width, depth, rotation };
}

const TINY_ROOM = { width: 72, depth: 72 };       // 6' × 6'
const SMALL_ROOM = { width: 96, depth: 96 };      // 8' × 8'
const MEDIUM_ROOM = { width: 144, depth: 168 };   // 12' × 14'
const LARGE_ROOM = { width: 240, depth: 360 };    // 20' × 30'

describe('getAABB', () => {
  it('returns the unrotated box for rotation = 0', () => {
    const box = getAABB(item({ x: 10, y: 20, width: 30, depth: 40, rotation: 0 }));
    expect(box.left).toBeCloseTo(10);
    expect(box.top).toBeCloseTo(20);
    expect(box.right).toBeCloseTo(40);
    expect(box.bottom).toBeCloseTo(60);
  });

  it('swaps width and depth for a 90° rotation around the item center', () => {
    // 30×40 rotated 90° → bounding box becomes 40×30 in axis-aligned terms.
    const box = getAABB(item({ x: 0, y: 0, width: 30, depth: 40, rotation: 90 }));
    expect(box.right - box.left).toBeCloseTo(40);
    expect(box.bottom - box.top).toBeCloseTo(30);
  });

  it('produces a symmetric diagonal box for 45°', () => {
    // 20×20 rotated 45° → enclosing box is 20*sqrt(2) on each side, centered on the item center.
    const box = getAABB(item({ x: 0, y: 0, width: 20, depth: 20, rotation: 45 }));
    const expected = 20 * Math.sqrt(2);
    expect(box.right - box.left).toBeCloseTo(expected);
    expect(box.bottom - box.top).toBeCloseTo(expected);
  });

  it('normalizes negative rotations the same as their positive counterparts', () => {
    const negative = getAABB(item({ width: 30, depth: 40, rotation: -90 }));
    const positive = getAABB(item({ width: 30, depth: 40, rotation: 270 }));
    expect(negative.left).toBeCloseTo(positive.left);
    expect(negative.right).toBeCloseTo(positive.right);
    expect(negative.top).toBeCloseTo(positive.top);
    expect(negative.bottom).toBeCloseTo(positive.bottom);
  });

  it('handles zero-size items without throwing', () => {
    const box = getAABB(item({ x: 5, y: 5, width: 0, depth: 0 }));
    expect(box.left).toBeCloseTo(box.right);
    expect(box.top).toBeCloseTo(box.bottom);
  });
});

describe('overlaps', () => {
  const a = { left: 0, top: 0, right: 10, bottom: 10 };

  it('detects clear overlap', () => {
    const b = { left: 5, top: 5, right: 15, bottom: 15 };
    expect(overlaps(a, b)).toBe(true);
  });

  it('detects full containment', () => {
    const b = { left: 2, top: 2, right: 6, bottom: 6 };
    expect(overlaps(a, b)).toBe(true);
  });

  it('treats edge-touching boxes as NOT overlapping (right edge meets left edge)', () => {
    const b = { left: 10, top: 0, right: 20, bottom: 10 };
    expect(overlaps(a, b)).toBe(false);
  });

  it('treats edge-touching boxes as NOT overlapping (bottom meets top)', () => {
    const b = { left: 0, top: 10, right: 10, bottom: 20 };
    expect(overlaps(a, b)).toBe(false);
  });

  it('returns false for fully separated boxes', () => {
    const b = { left: 20, top: 20, right: 30, bottom: 30 };
    expect(overlaps(a, b)).toBe(false);
  });

  it('is symmetric', () => {
    const b = { left: 5, top: 5, right: 15, bottom: 15 };
    expect(overlaps(a, b)).toBe(overlaps(b, a));
  });
});

describe('withinRoom', () => {
  it('returns true when the box is fully inside the room', () => {
    const box = getAABB(item({ x: 12, y: 12, width: 24, depth: 24 }));
    expect(withinRoom(box, MEDIUM_ROOM)).toBe(true);
  });

  it('returns true when the box exactly fills the room', () => {
    const box = getAABB(item({ x: 0, y: 0, width: SMALL_ROOM.width, depth: SMALL_ROOM.depth }));
    expect(withinRoom(box, SMALL_ROOM)).toBe(true);
  });

  it('rejects a box that extends past the right wall', () => {
    const box = getAABB(item({ x: SMALL_ROOM.width - 10, y: 0, width: 24, depth: 24 }));
    expect(withinRoom(box, SMALL_ROOM)).toBe(false);
  });

  it('rejects a box that extends past the bottom wall', () => {
    const box = getAABB(item({ x: 0, y: SMALL_ROOM.depth - 10, width: 24, depth: 24 }));
    expect(withinRoom(box, SMALL_ROOM)).toBe(false);
  });

  it('rejects a box with negative x_inches (past left wall)', () => {
    const box = getAABB(item({ x: -5, y: 10, width: 24, depth: 24 }));
    expect(withinRoom(box, SMALL_ROOM)).toBe(false);
  });

  it('rejects a box with negative y_inches (past top wall)', () => {
    const box = getAABB(item({ x: 10, y: -5, width: 24, depth: 24 }));
    expect(withinRoom(box, SMALL_ROOM)).toBe(false);
  });

  it('returns true (no constraint) when room has no dimensions', () => {
    const box = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(withinRoom(box, null)).toBe(true);
    expect(withinRoom(box, {})).toBe(true);
    expect(withinRoom(box, { width: 0, depth: 0 })).toBe(true);
  });

  it('rejects an item too large for the room regardless of placement', () => {
    // 120" sofa in a 96" room — guaranteed to overflow.
    const box = getAABB(item({ x: 0, y: 0, width: 120, depth: 36 }));
    expect(withinRoom(box, SMALL_ROOM)).toBe(false);
  });

  it('accepts a tight-fitting item in a large room', () => {
    const box = getAABB(item({ x: 100, y: 100, width: 84, depth: 36 }));
    expect(withinRoom(box, LARGE_ROOM)).toBe(true);
  });
});

describe('validateAll', () => {
  it('returns valid for an empty layout', () => {
    const result = validateAll([], MEDIUM_ROOM);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns valid for a single in-bounds item', () => {
    const sofa = item({ id: 'sofa', name: 'Sofa', x: 24, y: 24, width: 84, depth: 36 });
    const result = validateAll([sofa], MEDIUM_ROOM);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('flags an item that extends outside the room', () => {
    const bed = item({ id: 'bed', name: 'King Bed', x: 70, y: 0, width: 80, depth: 84 });
    const result = validateAll([bed], SMALL_ROOM);
    expect(result.valid).toBe(false);
    expect(result.errors.some((msg) => msg.includes('outside the room'))).toBe(true);
    expect(result.errors.some((msg) => msg.includes('King Bed'))).toBe(true);
  });

  it('flags two overlapping items', () => {
    const sofa = item({ id: 'sofa', name: 'Sofa', x: 0, y: 0, width: 84, depth: 36 });
    const table = item({ id: 'table', name: 'Coffee Table', x: 24, y: 12, width: 36, depth: 18 });
    const result = validateAll([sofa, table], LARGE_ROOM);
    expect(result.valid).toBe(false);
    expect(result.errors.some((msg) => msg.includes('overlaps'))).toBe(true);
    expect(result.errors.some((msg) => msg.includes('Sofa'))).toBe(true);
    expect(result.errors.some((msg) => msg.includes('Coffee Table'))).toBe(true);
  });

  it('does not flag two items that exactly touch on an edge', () => {
    const a = item({ id: 'a', name: 'A', x: 0, y: 0, width: 24, depth: 24 });
    const b = item({ id: 'b', name: 'B', x: 24, y: 0, width: 24, depth: 24 });
    const result = validateAll([a, b], MEDIUM_ROOM);
    expect(result.valid).toBe(true);
  });

  it('reports multiple errors at once', () => {
    // One item out of bounds, two others overlapping.
    const outOfBounds = item({ id: 'oob', name: 'Outside', x: SMALL_ROOM.width - 5, y: 0, width: 24, depth: 24 });
    const c = item({ id: 'c', name: 'C', x: 0, y: 0, width: 24, depth: 24 });
    const d = item({ id: 'd', name: 'D', x: 10, y: 10, width: 24, depth: 24 });
    const result = validateAll([outOfBounds, c, d], SMALL_ROOM);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('does not produce duplicate pair errors (each pair reported once)', () => {
    const a = item({ id: 'a', name: 'A', x: 0, y: 0 });
    const b = item({ id: 'b', name: 'B', x: 10, y: 10 });
    const result = validateAll([a, b], LARGE_ROOM);
    const overlapErrors = result.errors.filter((msg) => msg.includes('overlaps'));
    expect(overlapErrors.length).toBe(1);
  });

  it('handles a rotated item that fits axis-aligned but rotates out of bounds', () => {
    // A 60×20 bench at (20, 70) fits axis-aligned in a 96×96 room.
    // Rotated 45° its bounding box grows to ~56.6 on each side and the center
    // drifts further out (getItemCenter uses the rotated bbox), pushing the
    // bottom well past depth=96.
    const placed = item({ id: 'r', name: 'Long Bench', x: 20, y: 70, width: 60, depth: 20, rotation: 0 });
    const rotated = { ...placed, rotation: 45 };
    expect(validateAll([placed], SMALL_ROOM).valid).toBe(true);
    expect(validateAll([rotated], SMALL_ROOM).valid).toBe(false);
  });

  describe('different room dimensions', () => {
    const sofa = () => item({ id: 'sofa', name: 'Sofa', x: 0, y: 0, width: 84, depth: 36 });

    it('an 84" sofa overflows a 6×6 room', () => {
      expect(validateAll([sofa()], TINY_ROOM).valid).toBe(false);
    });

    it('an 84" sofa fits in an 8×8 room', () => {
      expect(validateAll([sofa()], SMALL_ROOM).valid).toBe(true);
    });

    it('an 84" sofa fits in a 12×14 room', () => {
      expect(validateAll([sofa()], MEDIUM_ROOM).valid).toBe(true);
    });

    it('an 84" sofa fits in a 20×30 room', () => {
      expect(validateAll([sofa()], LARGE_ROOM).valid).toBe(true);
    });
  });

  describe('different furniture sizes', () => {
    it('a small nightstand (18×18) fits anywhere in a small room', () => {
      const ns = item({ id: 'ns', name: 'Nightstand', x: 0, y: 0, width: 18, depth: 18 });
      expect(validateAll([ns], SMALL_ROOM).valid).toBe(true);
    });

    it('a king bed (76×80) only fits in rooms larger than 6×6', () => {
      const kingBed = item({ id: 'king', name: 'King Bed', x: 0, y: 0, width: 76, depth: 80 });
      expect(validateAll([kingBed], TINY_ROOM).valid).toBe(false);
      expect(validateAll([kingBed], MEDIUM_ROOM).valid).toBe(true);
      expect(validateAll([kingBed], LARGE_ROOM).valid).toBe(true);
    });

    it('a dining table + 4 chairs all fit and do not overlap in a medium room', () => {
      const table = item({ id: 't', name: 'Dining Table', x: 36, y: 60, width: 60, depth: 36 });
      const chairA = item({ id: 'c1', name: 'Chair A', x: 36, y: 24, width: 18, depth: 18 });
      const chairB = item({ id: 'c2', name: 'Chair B', x: 78, y: 24, width: 18, depth: 18 });
      const chairC = item({ id: 'c3', name: 'Chair C', x: 36, y: 102, width: 18, depth: 18 });
      const chairD = item({ id: 'c4', name: 'Chair D', x: 78, y: 102, width: 18, depth: 18 });
      const result = validateAll([table, chairA, chairB, chairC, chairD], MEDIUM_ROOM);
      expect(result.valid).toBe(true);
    });
  });
});
