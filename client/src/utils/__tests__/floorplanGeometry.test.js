import { describe, it, expect } from 'vitest';
import {
  zonesToImagePixels,
  zonesLookBoundaryRelative,
  resolveEditorZonesFromParse,
  ensureFloorplanZonesInImageSpace,
} from '@/utils/floorplanGeometry';

describe('floorplanGeometry coordinates', () => {
  const boundary = { x: 40, y: 30, w: 600, h: 400 };

  it('shifts boundary-relative zones to image pixels', () => {
    const zones = [
      {
        id: 'z1',
        name: 'Living',
        bbox: [20, 14, 240, 170],
        polygon: [
          [20, 14],
          [240, 14],
          [240, 170],
          [20, 170],
        ],
      },
    ];
    const out = zonesToImagePixels(zones, boundary);
    expect(out[0].bbox).toEqual([60, 44, 280, 200]);
    expect(out[0].polygon[0]).toEqual([60, 44]);
  });

  it('detects boundary-relative zones', () => {
    expect(zonesLookBoundaryRelative([{ bbox: [10, 10, 500, 350] }], boundary)).toBe(true);
    expect(zonesLookBoundaryRelative([{ bbox: [10, 10, 700, 500] }], boundary)).toBe(false);
  });

  it('prefers raw rooms in image space from parse result', () => {
    const resolved = resolveEditorZonesFromParse({
      boundary,
      image_width: 736,
      image_height: 520,
      rooms: [{ label: 'Kitchen', bbox: [100, 80, 400, 300], polygon: [[100, 80], [400, 80], [400, 300], [100, 300]] }],
      zones: [{ id: 'z', name: 'Wrong', bbox: [0, 0, 50, 50] }],
    });
    expect(resolved[0].label).toBe('Kitchen');
    expect(resolved[0].bbox[0]).toBe(100);
  });

  it('lifts normalized zones when rooms array empty', () => {
    const resolved = resolveEditorZonesFromParse({
      boundary,
      image_width: 736,
      image_height: 520,
      rooms: [],
      zones: [{ id: 'z1', name: 'Bed', bbox: [10, 20, 200, 180] }],
    });
    expect(resolved[0].bbox).toEqual([50, 50, 240, 210]);
  });

  it('ensureFloorplanZonesInImageSpace fixes stored boundary-relative zones', () => {
    const fixed = ensureFloorplanZonesInImageSpace(
      [{ id: 'z1', bbox: [10, 20, 200, 180] }],
      { boundary, imageWidth: 736, imageHeight: 520 },
    );
    expect(fixed[0].bbox[0]).toBe(50);
  });
});
