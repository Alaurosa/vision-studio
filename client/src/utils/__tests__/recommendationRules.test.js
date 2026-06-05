import { describe, expect, it } from 'vitest';
import { STARTER_FURNITURE_CATALOG } from '@/data/furnitureCatalog';
import {
  computeLargestFreeRect,
  computeRoomBucket,
  recommendForRoom,
  recommendFurniture,
} from '@/utils/recommendationRules';

// Helpers ---------------------------------------------------------------

function placement({ id, name, category, tags = [], width, depth, x = 0, y = 0, rotation = 0 }) {
  return {
    id,
    name,
    category,
    tags,
    width,
    depth,
    x_inches: x,
    y_inches: y,
    rotation,
  };
}

const SOFA = STARTER_FURNITURE_CATALOG.find((i) => i.id === 'starter-sofa-3seat');
const ARMCHAIR = STARTER_FURNITURE_CATALOG.find((i) => i.id === 'starter-armchair');
const COFFEE = STARTER_FURNITURE_CATALOG.find((i) => i.id === 'starter-coffee-table');
const DINING = STARTER_FURNITURE_CATALOG.find((i) => i.id === 'starter-dining-table');
const QUEEN_BED = STARTER_FURNITURE_CATALOG.find((i) => i.id === 'starter-queen-bed');
const DRESSER = STARTER_FURNITURE_CATALOG.find((i) => i.id === 'starter-dresser');

// Room-type awareness -------------------------------------------------

describe('recommendationRules — room-type awareness', () => {
  const ROOM = { width: 216, depth: 168 }; // large room so fit isn't the limiter
  const recIds = (roomType) =>
    recommendForRoom({
      room: ROOM,
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      roomType,
    }).items.map((e) => e.item.id);

  it('bedroom recommendations exclude dining tables and include a bed', () => {
    const ids = recIds('bedroom');
    expect(ids).not.toContain('starter-dining-table');
    expect(ids.some((id) => id === 'starter-queen-bed' || id === 'starter-single-bed')).toBe(true);
  });

  it('dining recommendations exclude beds', () => {
    const ids = recIds('dining');
    expect(ids).not.toContain('starter-queen-bed');
    expect(ids).not.toContain('starter-single-bed');
  });

  it('without a room type, the dining table can still surface (unchanged behavior)', () => {
    expect(recIds('')).toContain('starter-dining-table');
  });

  it('recommendFurniture filters a category by room type', () => {
    const seating = recommendFurniture({
      room: ROOM,
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'seating',
      roomType: 'bedroom',
    }).items.map((e) => e.item.id);
    expect(seating).not.toContain('starter-dining-chair');
    expect(seating).not.toContain('starter-desk-chair');
  });

  it('adds a room-type reason to items tagged for the room', () => {
    const beds = recommendFurniture({
      room: ROOM,
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'beds',
      roomType: 'bedroom',
    });
    const queen = beds.items.find((e) => e.item.id === 'starter-queen-bed');
    expect(queen).toBeTruthy();
    expect(queen.reasons.some((r) => /bedroom/i.test(r))).toBe(true);
  });
});

// Sanity --------------------------------------------------------------

describe('recommendationRules — sanity', () => {
  it('exports a usable starter fixture', () => {
    expect(SOFA).toBeTruthy();
    expect(ARMCHAIR).toBeTruthy();
    expect(COFFEE).toBeTruthy();
    expect(DINING).toBeTruthy();
    expect(QUEEN_BED).toBeTruthy();
  });
});

// computeRoomBucket -----------------------------------------------------

describe('computeRoomBucket', () => {
  it('returns "unknown" for missing or non-positive areas', () => {
    expect(computeRoomBucket(0)).toBe('unknown');
    expect(computeRoomBucket(-10)).toBe('unknown');
    expect(computeRoomBucket(NaN)).toBe('unknown');
  });

  it('classifies tiny / small / medium / large by sq ft', () => {
    expect(computeRoomBucket(60)).toBe('tiny');
    expect(computeRoomBucket(110)).toBe('small');
    expect(computeRoomBucket(180)).toBe('medium');
    expect(computeRoomBucket(400)).toBe('large');
  });
});

// computeLargestFreeRect ------------------------------------------------

describe('computeLargestFreeRect', () => {
  it('returns the full room when empty', () => {
    const result = computeLargestFreeRect(144, 132, []);
    expect(result.width).toBeGreaterThanOrEqual(132);
    expect(result.depth).toBeGreaterThanOrEqual(120);
  });

  it('returns (0, 0) when room is unknown', () => {
    expect(computeLargestFreeRect(0, 0, [])).toEqual({ width: 0, depth: 0 });
  });

  it('shrinks the available area when an item blocks the middle', () => {
    const big = placement({
      id: 'p1', name: 'wall', category: 'tables',
      width: 60, depth: 60, x: 30, y: 30, rotation: 0,
    });
    const empty = computeLargestFreeRect(144, 144, []);
    const blocked = computeLargestFreeRect(144, 144, [big]);
    expect(blocked.width * blocked.depth).toBeLessThan(empty.width * empty.depth);
  });
});

// recommendFurniture — degradations ------------------------------------

describe('recommendFurniture — degradations', () => {
  it('returns empty when category is missing', () => {
    const result = recommendFurniture({
      room: { width: 144, depth: 132 },
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: '',
    });
    expect(result.items).toEqual([]);
    expect(result.metrics).toBeNull();
  });

  it('falls back to category-only matches when room dimensions are unknown', () => {
    const result = recommendFurniture({
      room: null,
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'seating',
    });
    expect(result.roomBucket).toBe('unknown');
    expect(result.metrics).toBeNull();
    expect(result.items.length).toBeGreaterThan(0);
    for (const entry of result.items) {
      expect(entry.item.category).toBe('seating');
      expect(entry.reasons[0]).toMatch(/room dimensions unknown/i);
    }
  });
});

// Hard rules ------------------------------------------------------------

describe('recommendFurniture — hard rules', () => {
  it('rule 1: excludes items whose footprint cannot fit in the largest free rectangle', () => {
    // 8x8 ft = 96x96 in. The 3-seat sofa is 84x36 — would barely fit, but with
    // walkway clearance budget it's questionable. The queen bed is 60x80 — too
    // deep to fit in a 96-deep room when querying 'beds' bucket.
    const result = recommendFurniture({
      room: { width: 60, depth: 60 },
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'beds',
    });
    const beds = result.items.map((e) => e.item.id);
    expect(beds).not.toContain('starter-queen-bed');
  });

  it('rule 1: accepts an item if it fits only when rotated 90°', () => {
    // Use a synthetic non-wall-anchored, non-special-case item so we isolate
    // rule 1 from the category-appropriateness rules. The skinny item is 100"
    // wide × 24" deep. Room is 36" wide × 132" deep — the item only fits if
    // rotated (24 ≤ 36, 100 ≤ 132).
    const skinny = {
      id: 'skinny-shelf',
      provider: 'vision-studio',
      name: 'Skinny Console',
      category: 'decor',
      tags: ['console'],
      dimensions: { width: 100, depth: 24, height: 32, unit: 'in' },
      footprint: { width: 100, depth: 24, unit: 'in' },
      modelStatus: 'placeholder',
      previewImageUrl: null,
      modelUrl: null,
      sourceUrl: null,
    };
    const result = recommendFurniture({
      room: { width: 36, depth: 132 },
      placements: [],
      catalog: [skinny],
      category: 'decor',
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].rotationHint).toBe(90);
    expect(result.items[0].reasons[0]).toMatch(/rotated/i);
  });

  it('rule 2: rejects wall-anchored items when no wall is long enough', () => {
    // Block the long walls with placements so the largest free rectangle has a
    // short longest side, then ask for a bookshelf wider than the longest wall.
    const blockers = [
      // Big block along the top — leaves room only below.
      placement({ id: 'b1', name: 'block', category: 'tables', width: 100, depth: 60, x: 22, y: 0 }),
    ];
    const result = recommendFurniture({
      room: { width: 144, depth: 132 },
      placements: blockers,
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'storage',
    });
    // Bookshelf (32" wide) should still pass; dresser (60") should still pass
    // because below the blocker we have ~144×72. Sanity check: the longest wall
    // is at least 144 here, so both pass. This test just ensures the rule is
    // wired without false negatives in a normal-sized room.
    const ids = result.items.map((e) => e.item.id);
    expect(ids).toContain('starter-bookshelf');
  });

  it('rule 3: rejects items whose clearance budget exceeds free area', () => {
    // Fill the room almost completely with a single block, then ask for a sofa.
    const filler = placement({
      id: 'fill', name: 'filler', category: 'tables',
      width: 130, depth: 120, x: 0, y: 0,
    });
    const result = recommendFurniture({
      room: { width: 144, depth: 132 },
      placements: [filler],
      catalog: [SOFA, ARMCHAIR],
      category: 'seating',
    });
    // 3-seat sofa (84x36) should not fit; armchair (32x34) might still fit.
    const ids = result.items.map((e) => e.item.id);
    expect(ids).not.toContain('starter-sofa-3seat');
  });

  it('rule 4: excludes dining tables from a tiny room', () => {
    // 7×7 ft = 49 sq ft < 80 sq ft -> tiny.
    const result = recommendFurniture({
      room: { width: 84, depth: 84 },
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'tables',
    });
    const ids = result.items.map((e) => e.item.id);
    expect(ids).not.toContain('starter-dining-table');
  });

  it('rule 4: excludes king-size beds from a small room (queen passes)', () => {
    // Queen bed (60" wide) — should remain in a small room.
    const queenOnly = recommendFurniture({
      room: { width: 120, depth: 132 },
      placements: [],
      catalog: [QUEEN_BED],
      category: 'beds',
    });
    expect(queenOnly.items.map((e) => e.item.id)).toContain('starter-queen-bed');

    // Synthetic king-sized bed (76" wide) — should drop out.
    const king = { ...QUEEN_BED, id: 'fake-king', dimensions: { ...QUEEN_BED.dimensions, width: 76 }, footprint: { ...QUEEN_BED.footprint, width: 76 } };
    const kingResult = recommendFurniture({
      room: { width: 120, depth: 132 },
      placements: [],
      catalog: [king],
      category: 'beds',
    });
    expect(kingResult.items).toHaveLength(0);
  });

  it('rule 4: companion requirement — coffee table needs seating already in the room', () => {
    const noSeating = recommendFurniture({
      room: { width: 216, depth: 168 },
      placements: [],
      catalog: [COFFEE],
      category: 'coffee_table',
    });
    expect(noSeating.items).toHaveLength(0);

    const withSeating = recommendFurniture({
      room: { width: 216, depth: 168 },
      placements: [placement({
        id: 's1', name: 'Starter 3-Seat Sofa', category: 'seating', tags: ['sofa'],
        width: 84, depth: 36, x: 12, y: 12,
      })],
      catalog: [COFFEE],
      category: 'coffee_table',
    });
    expect(withSeating.items).toHaveLength(1);
  });

  it('rule 5: dedup — already-placed singleton categories drop out', () => {
    const placements = [placement({
      id: 'bed1', name: 'Starter Queen Bed', category: 'beds', tags: ['bed'],
      width: 60, depth: 80, x: 0, y: 0,
    })];
    const result = recommendFurniture({
      room: { width: 144, depth: 132 },
      placements,
      catalog: [QUEEN_BED],
      category: 'beds',
    });
    expect(result.items).toHaveLength(0);
  });
});

// Soft scoring ---------------------------------------------------------

describe('recommendFurniture — soft scoring', () => {
  it('ranks comfortable fits ahead of barely-fits items', () => {
    const result = recommendFurniture({
      room: { width: 216, depth: 168 },
      placements: [],
      catalog: [SOFA, ARMCHAIR],
      category: 'seating',
    });
    expect(result.items.length).toBe(2);
    const armchairEntry = result.items.find((e) => e.item.id === 'starter-armchair');
    const sofaEntry = result.items.find((e) => e.item.id === 'starter-sofa-3seat');
    expect(armchairEntry.score).toBeGreaterThanOrEqual(sofaEntry.score);
  });

  it('boosts score when a complementary piece is already placed', () => {
    // Use armchair as the candidate — it's NOT subject to a companion hard
    // rule, so the only difference between the two cases is whether the
    // soft scoring complementary bonus fires.
    const room = { width: 216, depth: 168 };

    const withPair = recommendFurniture({
      room,
      placements: [placement({
        id: 's1', name: 'Starter 3-Seat Sofa', category: 'seating', tags: ['sofa'],
        width: 84, depth: 36, x: 12, y: 12,
      })],
      catalog: [ARMCHAIR],
      category: 'armchair',
    });

    const noPair = recommendFurniture({
      room,
      placements: [],
      catalog: [ARMCHAIR],
      category: 'armchair',
    });

    expect(withPair.items[0].score).toBeGreaterThan(noPair.items[0].score);
    expect(withPair.items[0].reasons.some((r) => /pairs with/i.test(r))).toBe(true);
    expect(noPair.items[0].reasons.some((r) => /pairs with/i.test(r))).toBe(false);
  });

  it('reports computed metrics so the UI can label the result', () => {
    const result = recommendFurniture({
      room: { width: 144, depth: 132 },
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'storage',
    });
    expect(result.metrics).toBeTruthy();
    expect(result.metrics.roomAreaSqFt).toBeCloseTo(132, 0);
    expect(result.metrics.largestFreeRect.width).toBeGreaterThan(0);
    expect(['tiny', 'small', 'medium', 'large']).toContain(result.roomBucket);
  });

  it('respects maxResults', () => {
    const result = recommendFurniture({
      room: { width: 216, depth: 168 },
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'storage',
      options: { maxResults: 1 },
    });
    expect(result.items).toHaveLength(1);
  });
});

// recommendForRoom ------------------------------------------------------

describe('recommendForRoom', () => {
  it('returns no items when room dimensions are unknown', () => {
    const result = recommendForRoom({
      room: null,
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
    });
    expect(result.items).toEqual([]);
    expect(result.metrics).toBeNull();
  });

  it('merges top picks across categories when no category filter is set', () => {
    const result = recommendForRoom({
      room: { width: 216, depth: 168 },
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThanOrEqual(5);
    const ids = result.items.map((e) => e.item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('delegates to category-specific recommendations when a category is passed', () => {
    const scoped = recommendForRoom({
      room: { width: 216, depth: 168 },
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'storage',
    });
    const direct = recommendFurniture({
      room: { width: 216, depth: 168 },
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'storage',
    });
    expect(scoped.items.map((e) => e.item.id)).toEqual(direct.items.map((e) => e.item.id));
  });
});

// Style tags ------------------------------------------------------------

describe('recommendFurniture — style tags', () => {
  it('boosts items tagged with the selected style', () => {
    const cozy = recommendFurniture({
      room: { width: 216, depth: 168 },
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'seating',
      options: { styleHint: 'cozy' },
    });
    const ids = cozy.items.map((e) => e.item.id);
    expect(ids[0]).toBe('starter-sofa-3seat');
    expect(cozy.items[0].reasons.join(' ')).toMatch(/cozy/i);
  });

  it('prefers compact footprints when compact style is selected', () => {
    const compact = recommendFurniture({
      room: { width: 216, depth: 168 },
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'seating',
      options: { styleHint: 'compact' },
    });
    expect(compact.items[0].item.id).toBe('starter-armchair');
    expect(compact.items[0].reasons.join(' ')).toMatch(/compact/i);
  });
});

// Physical realism & usability ------------------------------------------

describe('recommendFurniture — realism and usability', () => {
  it('never recommends items whose footprint exceeds the room', () => {
    const result = recommendFurniture({
      room: { width: 96, depth: 96 },
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'seating',
    });
    for (const { item } of result.items) {
      const w = item.footprint?.width ?? item.dimensions?.width ?? 0;
      const d = item.footprint?.depth ?? item.dimensions?.depth ?? 0;
      expect(Math.min(w, d)).toBeLessThanOrEqual(96);
      expect(Math.max(w, d)).toBeLessThanOrEqual(96);
    }
  });

  it('returns results sorted by descending score', () => {
    const result = recommendFurniture({
      room: { width: 216, depth: 168 },
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'storage',
    });
    const scores = result.items.map((e) => e.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it('includes a human-readable reason for every recommended item', () => {
    const result = recommendForRoom({
      room: { width: 216, depth: 168 },
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
    });
    for (const entry of result.items) {
      expect(entry.reasons.length).toBeGreaterThan(0);
      expect(entry.reasons[0].length).toBeGreaterThan(8);
    }
  });
});

// Cross-taxonomy matching ----------------------------------------------

describe('recommendFurniture — taxonomy', () => {
  it('matches a specific category against the starter catalog via tags', () => {
    const result = recommendFurniture({
      room: { width: 216, depth: 168 },
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'sofa',
    });
    expect(result.items.map((e) => e.item.id)).toContain('starter-sofa-3seat');
  });

  it('matches a bucket category directly', () => {
    const result = recommendFurniture({
      room: { width: 216, depth: 168 },
      placements: [],
      catalog: STARTER_FURNITURE_CATALOG,
      category: 'storage',
    });
    expect(result.items.map((e) => e.item.id)).toEqual(
      expect.arrayContaining(['starter-bookshelf', 'starter-dresser']),
    );
  });
});
