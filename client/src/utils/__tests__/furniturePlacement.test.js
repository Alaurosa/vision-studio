import { describe, expect, it } from 'vitest';
import { STARTER_FURNITURE_CATALOG } from '@/data/furnitureCatalog';
import {
  createPlacedFurnitureFromCatalogItem,
  getFurnitureFootprintSize,
} from '@/utils/furniturePlacement';

const sample = STARTER_FURNITURE_CATALOG[0];

describe('furniturePlacement', () => {
  it('getFurnitureFootprintSize prefers footprint over dimensions', () => {
    expect(getFurnitureFootprintSize(sample)).toEqual({
      width: sample.footprint.width,
      depth: sample.footprint.depth,
    });
  });

  it('createPlacedFurnitureFromCatalogItem builds a unique placed instance', () => {
    const placed = createPlacedFurnitureFromCatalogItem(sample, { x_inches: 48, y_inches: 36 });

    expect(placed.id).toBeTruthy();
    expect(placed.catalogItemId).toBe(sample.id);
    expect(placed.name).toBe(sample.name);
    expect(placed.category).toBe(sample.category);
    expect(placed.provider).toBe(sample.provider);
    expect(placed.width).toBe(sample.footprint.width);
    expect(placed.depth).toBe(sample.footprint.depth);
    expect(placed.rotation).toBe(0);
    expect(placed.dimensions).toEqual(sample.dimensions);
    expect(placed.footprint).toEqual(sample.footprint);
    expect(placed.previewImageUrl).toBe(sample.previewImageUrl);
    expect(placed.modelStatus).toBe(sample.modelStatus);
    expect(placed.tags).toEqual(sample.tags);
    expect(placed.x_inches).toBeDefined();
    expect(placed.y_inches).toBeDefined();
    expect(placed).not.toBe(sample);
    expect(STARTER_FURNITURE_CATALOG[0]).toEqual(sample);
  });

  it('assigns unique ids for repeated placements', () => {
    const first = createPlacedFurnitureFromCatalogItem(sample, { x_inches: 12, y_inches: 12 });
    const second = createPlacedFurnitureFromCatalogItem(sample, { x_inches: 48, y_inches: 48 });
    expect(first.id).not.toBe(second.id);
    expect(first.catalogItemId).toBe(second.catalogItemId);
  });

  it('centers placement on the click position (grid-snapped)', () => {
    const placed = createPlacedFurnitureFromCatalogItem(
      sample,
      { x_inches: 102, y_inches: 84 },
      { center: true },
    );
    const centerX = placed.x_inches + placed.width / 2;
    const centerY = placed.y_inches + placed.depth / 2;
    expect(centerX).toBeCloseTo(102, 0);
    expect(centerY).toBeCloseTo(84, 0);
  });
});
