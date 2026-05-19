import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '@/store/layoutStore';

// Tests the store's `validate()` wiring — i.e. that the editor's
// "Check Layout" path correctly returns errors for boundary + collision
// violations. The pure math is covered in utils/__tests__/collision.test.js;
// this file proves the store delegates correctly.

const ROOM = { id: 'draft-test', name: 'Test', width: 144, depth: 168 };

function item({ id, name, x = 0, y = 0, w = 24, d = 24, rot = 0 }) {
  return { id, name, x_inches: x, y_inches: y, width: w, depth: d, rotation: rot };
}

beforeEach(() => {
  useLayoutStore.setState({ room: null, furniture: [], selectedId: null });
});

describe('layoutStore.validate', () => {
  it('returns valid for an empty room', () => {
    useLayoutStore.setState({ room: ROOM, furniture: [] });
    const { valid, errors } = useLayoutStore.getState().validate();
    expect(valid).toBe(true);
    expect(errors).toEqual([]);
  });

  it('returns valid when a single item fits inside the room', () => {
    useLayoutStore.setState({
      room: ROOM,
      furniture: [item({ id: 'a', name: 'Sofa', x: 24, y: 24, w: 84, d: 36 })],
    });
    const { valid, errors } = useLayoutStore.getState().validate();
    expect(valid).toBe(true);
    expect(errors).toEqual([]);
  });

  it('flags an item that extends outside the room', () => {
    useLayoutStore.setState({
      room: ROOM,
      furniture: [item({ id: 'a', name: 'Table', x: 130, y: 0, w: 60, d: 30 })],
    });
    const { valid, errors } = useLayoutStore.getState().validate();
    expect(valid).toBe(false);
    expect(errors).toEqual(['Table extends outside the room.']);
  });

  it('flags two items that overlap', () => {
    useLayoutStore.setState({
      room: ROOM,
      furniture: [
        item({ id: 'a', name: 'Sofa', x: 10, y: 10, w: 60, d: 30 }),
        item({ id: 'b', name: 'Chair', x: 30, y: 20, w: 30, d: 30 }),
      ],
    });
    const { valid, errors } = useLayoutStore.getState().validate();
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('overlaps'))).toBe(true);
  });

  it('reports both boundary and collision errors together', () => {
    useLayoutStore.setState({
      room: ROOM,
      furniture: [
        item({ id: 'a', name: 'BigBed', x: 130, y: 0, w: 60, d: 30 }),
        item({ id: 'b', name: 'Desk', x: 10, y: 10, w: 60, d: 30 }),
        item({ id: 'c', name: 'Chair', x: 20, y: 15, w: 30, d: 30 }),
      ],
    });
    const { valid, errors } = useLayoutStore.getState().validate();
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('outside the room'))).toBe(true);
    expect(errors.some((e) => e.includes('overlaps'))).toBe(true);
  });

  it('does not crash when room is null', () => {
    useLayoutStore.setState({
      room: null,
      furniture: [item({ id: 'a', name: 'Sofa', x: 0, y: 0, w: 60, d: 30 })],
    });
    expect(() => useLayoutStore.getState().validate()).not.toThrow();
    const { valid } = useLayoutStore.getState().validate();
    // With no room, withinRoom returns true for all → no boundary errors,
    // and one item alone can't overlap anything, so valid.
    expect(valid).toBe(true);
  });

  it('reflects state changes between calls', () => {
    useLayoutStore.setState({ room: ROOM, furniture: [] });
    expect(useLayoutStore.getState().validate().valid).toBe(true);

    useLayoutStore.setState({
      furniture: [item({ id: 'a', name: 'Sofa', x: 130, y: 0, w: 60, d: 30 })],
    });
    expect(useLayoutStore.getState().validate().valid).toBe(false);

    useLayoutStore.setState({ furniture: [] });
    expect(useLayoutStore.getState().validate().valid).toBe(true);
  });

  it('rotation that causes overlap with a neighbor is caught', () => {
    // A wide-flat sofa (60×30) at (10,30) — AABB (10,30)→(70,60). A small
    // item directly below it at (40,70) — AABB (40,70)→(60,90). Unrotated,
    // there's a 10-inch vertical gap so no overlap.
    //
    // Rotate the sofa 90° about its center (40,45). Its bbox swaps to 30×60
    // (deeper), so x_inches=25, y_inches=15. New AABB is (25,15)→(55,75) —
    // it now extends down into the small item below, triggering overlap.
    const sofa = item({ id: 'a', name: 'Sofa', x: 10, y: 30, w: 60, d: 30, rot: 0 });
    const stool = item({ id: 'b', name: 'Stool', x: 40, y: 70, w: 20, d: 20, rot: 0 });
    useLayoutStore.setState({ room: ROOM, furniture: [sofa, stool] });
    expect(useLayoutStore.getState().validate().valid).toBe(true);

    const rotated = { ...sofa, x_inches: 25, y_inches: 15, rotation: 90 };
    useLayoutStore.setState({ furniture: [rotated, stool] });
    const { valid, errors } = useLayoutStore.getState().validate();
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('overlaps'))).toBe(true);
  });

  it('rotating back to 0 from an invalid 90° restores validity', () => {
    const baseSofa = item({ id: 'a', name: 'Sofa', x: 0, y: 130, w: 84, d: 36, rot: 0 });
    useLayoutStore.setState({ room: ROOM, furniture: [{ ...baseSofa, rotation: 90 }] });
    expect(useLayoutStore.getState().validate().valid).toBe(false);
    useLayoutStore.setState({ furniture: [{ ...baseSofa, rotation: 0 }] });
    expect(useLayoutStore.getState().validate().valid).toBe(true);
  });

  it('rotation that pushes bbox past the wall is caught', () => {
    // 84x36 sofa near the corner — fits at rotation 0, fails at 90 because
    // rotated bbox extends further along the y-axis.
    // At y=130, rotation 0 bbox bottom = 166 (fits in 168). Rotation 90 swaps
    // bbox to 36×84, so bottom becomes 214 — overflows.
    const baseSofa = item({ id: 'a', name: 'Sofa', x: 0, y: 130, w: 84, d: 36, rot: 0 });
    useLayoutStore.setState({ room: ROOM, furniture: [baseSofa] });
    expect(useLayoutStore.getState().validate().valid).toBe(true);

    useLayoutStore.setState({ furniture: [{ ...baseSofa, rotation: 90 }] });
    expect(useLayoutStore.getState().validate().valid).toBe(false);
  });
});
