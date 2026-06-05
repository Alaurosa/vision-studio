import { describe, expect, it } from 'vitest';
import {
  generateLayout,
  generateLayoutFromCatalog,
  normalizeRoomType,
  ROOM_LAYOUT_CONSTRAINTS,
  selectItemsForRoomType,
} from '../services/layoutGenerator.js';
import * as fallback from '../services/fallbackStore.js';

const BEDROOM = { width: 144, depth: 132 };
const LIVING = { width: 216, depth: 168 };

function pickCatalog(category, n = 1) {
  return fallback.getCatalog({ category, limit: n }).items;
}

describe('layoutGenerator', () => {
  it('exports bedroom and living_room constraints', () => {
    expect(ROOM_LAYOUT_CONSTRAINTS.bedroom).toBeDefined();
    expect(ROOM_LAYOUT_CONSTRAINTS.living_room).toBeDefined();
    expect(ROOM_LAYOUT_CONSTRAINTS.bedroom.categories).toContain('bed');
    expect(ROOM_LAYOUT_CONSTRAINTS.living_room.categories).toContain('sofa');
  });

  it('normalizeRoomType accepts aliases', () => {
    expect(normalizeRoomType('living')).toBe('living_room');
    expect(normalizeRoomType('Bedroom')).toBe('bedroom');
  });

  it('generates valid bedroom layout with bed on north wall', () => {
    const bed = pickCatalog('bed', 1)[0];
    const ns1 = pickCatalog('nightstand', 1)[0];
    const ns2 = pickCatalog('nightstand', 1)[0];
    const dresser = pickCatalog('dresser', 1)[0];

    const furniture = [
      { id: 'b1', ...bed, category: 'bed' },
      { id: 'n1', ...ns1, category: 'nightstand' },
      { id: 'n2', ...ns2, category: 'nightstand' },
      { id: 'd1', ...dresser, category: 'dresser' },
    ];

    const result = generateLayout({
      roomType: 'bedroom',
      room: BEDROOM,
      furniture,
    });

    expect(result.method).toBe('constraint_layout_v1');
    expect(result.room_type).toBe('bedroom');
    expect(result.placements.length).toBe(4);
    expect(result.validation.valid).toBe(true);

    const bedPlacement = result.placements.find((p) => p.category === 'bed');
    expect(bedPlacement).toBeDefined();
    expect(bedPlacement.y_inches).toBeLessThanOrEqual(18);
    expect(bedPlacement.x_inches).toBeGreaterThan(0);
    expect(bedPlacement.x_inches + bed.width).toBeLessThanOrEqual(BEDROOM.width);

    const nightstands = result.placements.filter((p) => p.category === 'nightstand');
    expect(nightstands.length).toBe(2);
    const bedBox = {
      left: bedPlacement.x_inches,
      right: bedPlacement.x_inches + bed.width,
    };
    for (const ns of nightstands) {
      const center = ns.x_inches + ns.width / 2;
      expect(center < bedBox.left || center > bedBox.right).toBe(true);
    }
  });

  it('generates valid living room layout with TV focal and sofa facing it', () => {
    const tv = pickCatalog('tv_stand', 1)[0];
    const sofa = pickCatalog('sofa', 1)[0];
    const table = pickCatalog('coffee_table', 1)[0];
    const chair = pickCatalog('armchair', 1)[0];

    const furniture = [
      { id: 'tv1', ...tv, category: 'tv_stand' },
      { id: 's1', ...sofa, category: 'sofa' },
      { id: 'c1', ...table, category: 'coffee_table' },
      { id: 'a1', ...chair, category: 'armchair' },
    ];

    const result = generateLayout({
      roomType: 'living_room',
      room: LIVING,
      furniture,
    });

    expect(result.validation.valid).toBe(true);
    expect(result.placements.length).toBe(4);

    const tvP = result.placements.find((p) => p.category === 'tv_stand');
    const sofaP = result.placements.find((p) => p.category === 'sofa');

    expect(tvP.y_inches).toBeLessThanOrEqual(18);
    expect(sofaP.y_inches).toBeGreaterThan(tvP.y_inches + tv.depth);
    expect(sofaP.rotation).toBe(180);
  });

  it('generateLayoutFromCatalog picks items and validates for bedroom', () => {
    const catalog = fallback.getCatalog({ limit: 50 }).items;
    const result = generateLayoutFromCatalog('bedroom', BEDROOM, () => catalog);

    expect(result.catalog_items.length).toBeGreaterThanOrEqual(3);
    expect(result.placements.length).toBe(result.catalog_items.length);
    expect(result.validation.valid).toBe(true);
    expect(result.placements.some((p) => p.category === 'bed')).toBe(true);
  });

  it('generateLayoutFromCatalog works for living_room', () => {
    const catalog = fallback.getCatalog({ limit: 50 }).items;
    const result = generateLayoutFromCatalog('living_room', LIVING, () => catalog);

    expect(result.validation.valid).toBe(true);
    expect(result.placements.some((p) => p.category === 'sofa')).toBe(true);
    expect(result.placements.some((p) => p.category === 'tv_stand')).toBe(true);
  });

  it('selectItemsForRoomType respects category order', () => {
    const catalog = fallback.getCatalog({ limit: 50 }).items;
    const bedroomItems = selectItemsForRoomType('bedroom', catalog);
    const cats = bedroomItems.map((i) => i.category);
    expect(cats.filter((c) => c === 'nightstand').length).toBe(2);
    expect(cats[0]).toBe('bed');
  });
});
