import { describe, it, expect } from 'vitest';
import { zoneScopedDimensions, scopeFurnitureToOrigin } from '@/utils/roomScope';

// Pure scoping math for the per-room 3D view (US: 3D shows only the selected
// room). Mirrors the 2D editor's active-zone crop so 3D matches 2D.

describe('zoneScopedDimensions', () => {
  const room = { width: 300, depth: 240, height: 96 };

  it('uses the zone bbox size + origin when a zone is active', () => {
    const bounds = { left: 50, top: 30, right: 170, bottom: 130 };
    const r = zoneScopedDimensions(room, bounds);
    expect(r.widthIn).toBe(120); // 170 - 50
    expect(r.depthIn).toBe(100); // 130 - 30
    expect(r.heightIn).toBe(96); // height always comes from the room
    expect(r.originX).toBe(50);
    expect(r.originY).toBe(30);
  });

  it('falls back to the whole room when no zone is active', () => {
    const r = zoneScopedDimensions(room, null);
    expect(r.widthIn).toBe(300);
    expect(r.depthIn).toBe(240);
    expect(r.heightIn).toBe(96);
    expect(r.originX).toBe(0);
    expect(r.originY).toBe(0);
  });

  it('uses sensible defaults when room is missing', () => {
    const r = zoneScopedDimensions(null, null);
    expect(r).toMatchObject({ widthIn: 180, depthIn: 144, heightIn: 96, originX: 0, originY: 0 });
  });

  it('clamps a degenerate (zero-size) zone to a minimum so the camera stays usable', () => {
    const bounds = { left: 100, top: 100, right: 100, bottom: 100 }; // 0×0
    const r = zoneScopedDimensions(room, bounds);
    expect(r.widthIn).toBeGreaterThanOrEqual(12);
    expect(r.depthIn).toBeGreaterThanOrEqual(12);
    expect(r.originX).toBe(100);
    expect(r.originY).toBe(100);
  });
});

describe('scopeFurnitureToOrigin', () => {
  const furniture = [
    { id: 'a', x_inches: 60, y_inches: 40, width: 24, depth: 24 },
    { id: 'b', x_inches: 120, y_inches: 90, width: 36, depth: 18 },
  ];

  it('subtracts the zone origin from each item (zone-local coords)', () => {
    const out = scopeFurnitureToOrigin(furniture, 50, 30);
    expect(out[0]).toMatchObject({ id: 'a', x_inches: 10, y_inches: 10 });
    expect(out[1]).toMatchObject({ id: 'b', x_inches: 70, y_inches: 60 });
    // other fields preserved
    expect(out[0].width).toBe(24);
  });

  it('returns the same array reference when origin is (0,0)', () => {
    expect(scopeFurnitureToOrigin(furniture, 0, 0)).toBe(furniture);
  });

  it('handles missing coordinates without NaN', () => {
    const out = scopeFurnitureToOrigin([{ id: 'c' }], 50, 30);
    expect(out[0].x_inches).toBe(-50);
    expect(out[0].y_inches).toBe(-30);
  });

  it('does not mutate the input items', () => {
    const input = [{ id: 'a', x_inches: 60, y_inches: 40 }];
    scopeFurnitureToOrigin(input, 50, 30);
    expect(input[0].x_inches).toBe(60);
  });
});
