import { describe, expect, it } from 'vitest';
import { autoArrangeFurniture, buildArrangePlan, inferRoomType } from '../services/autoArrange.js';
import { validateLayout, CLEARANCE_IN } from '../services/overlapResolver.js';
import * as fallback from '../services/fallbackStore.js';

const LIVING = { width: 216, depth: 168, name: 'Living' };

function catalogItem(category) {
  return fallback.getCatalog({ category, limit: 1 }).items[0];
}

describe('autoArrange', () => {
  it('infers living room from sofa + tv', () => {
    expect(inferRoomType([{ category: 'sofa' }, { category: 'tv_stand' }])).toBe('living_room');
  });

  it('buildArrangePlan returns ordered steps with rationale', () => {
    const sofa = catalogItem('sofa');
    const tv = catalogItem('tv_stand');
    const plan = buildArrangePlan(
      [
        { id: 's1', name: sofa.name, category: 'sofa', width: sofa.width, depth: sofa.depth },
        { id: 't1', name: tv.name, category: 'tv_stand', width: tv.width, depth: tv.depth },
      ],
      LIVING,
    );
    expect(plan.room_type).toBe('living_room');
    expect(plan.placement_order.length).toBe(2);
    expect(plan.placement_order[0].rationale).toBeTruthy();
    expect(plan.placement_order[0].category).toBe('tv_stand');
  });

  it('resolves overlapping starter positions with clearance', () => {
    const sofa = catalogItem('sofa');
    const table = catalogItem('coffee_table');
    const tv = catalogItem('tv_stand');

    const furniture = [
      {
        id: 'tv1',
        name: tv.name,
        category: 'tv_stand',
        width: tv.width,
        depth: tv.depth,
        height: tv.height,
        x_inches: 12,
        y_inches: 12,
        rotation: 0,
      },
      {
        id: 'sofa1',
        name: sofa.name,
        category: 'sofa',
        width: sofa.width,
        depth: sofa.depth,
        height: sofa.height,
        x_inches: 12,
        y_inches: 12,
        rotation: 0,
      },
      {
        id: 'ct1',
        name: table.name,
        category: 'coffee_table',
        width: table.width,
        depth: table.depth,
        height: table.height,
        x_inches: 12,
        y_inches: 12,
        rotation: 0,
      },
    ];

    const result = autoArrangeFurniture({ room: LIVING, placements: furniture });
    expect(result.placements.length).toBe(3);
    expect(result.plan).toBeTruthy();
    expect(result.validation.valid).toBe(true);

    const merged = furniture.map((f) => {
      const u = result.placements.find((p) => p.id === f.id);
      return { ...f, ...u };
    });
    const check = validateLayout(merged, LIVING, { clearance: CLEARANCE_IN });
    expect(check.valid).toBe(true);
  });
});
