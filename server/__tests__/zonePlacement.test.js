import { describe, expect, it } from 'vitest';
import {
  filterPlacementsForZone,
  findOpenSlotInZone,
  getZoneBounds,
  globalizeLayoutPosition,
  resolveZoneContext,
} from '../services/zonePlacement.js';

describe('zonePlacement', () => {
  const room = {
    width: 240,
    depth: 180,
    zones: [
      { id: 'zone-living', name: 'Living Room', bbox: [24, 24, 144, 120] },
      { id: 'zone-bed', name: 'Bedroom', bbox: [150, 24, 230, 120] },
    ],
  };

  it('resolves zone bounds from bbox', () => {
    const ctx = resolveZoneContext(room, 'zone-living');
    expect(ctx.bounds).toEqual({
      left: 24,
      top: 24,
      right: 144,
      bottom: 120,
      width: 120,
      depth: 96,
    });
  });

  it('filters placements to active zone by zone_id', () => {
    const placements = [
      { id: '1', name: 'Sofa', zone_id: 'zone-living', x_inches: 36, y_inches: 36, width: 84, depth: 36 },
      { id: '2', name: 'Bed', zone_id: 'zone-bed', x_inches: 160, y_inches: 36, width: 60, depth: 80 },
    ];
    const ctx = resolveZoneContext(room, 'zone-living');
    expect(filterPlacementsForZone(placements, ctx)).toHaveLength(1);
    expect(filterPlacementsForZone(placements, ctx)[0].name).toBe('Sofa');
  });

  it('finds open slot inside zone bounds', () => {
    const ctx = resolveZoneContext(room, 'zone-living');
    const slot = findOpenSlotInZone([], 48, 30, ctx, room);
    expect(slot.x).toBeGreaterThanOrEqual(24);
    expect(slot.y).toBeGreaterThanOrEqual(24);
    expect(slot.x + 48).toBeLessThanOrEqual(144);
    expect(slot.y + 30).toBeLessThanOrEqual(120);
  });

  it('offsets layout positions to floorplan coordinates', () => {
    const ctx = resolveZoneContext(room, 'zone-living');
    const global = globalizeLayoutPosition({ x_inches: 12, y_inches: 18 }, ctx);
    expect(global).toEqual({ x_inches: 36, y_inches: 42 });
  });

  it('reads bounds from polygon zones', () => {
    const bounds = getZoneBounds({
      polygon: [
        [10, 20],
        [50, 20],
        [50, 80],
        [10, 80],
      ],
    });
    expect(bounds.width).toBe(40);
    expect(bounds.depth).toBe(60);
    expect(bounds.left).toBe(10);
    expect(bounds.top).toBe(20);
  });
});
