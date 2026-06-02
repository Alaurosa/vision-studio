import { describe, expect, it } from 'vitest';
import {
  FURNITURE_CATEGORIES,
  STARTER_FURNITURE_CATALOG,
  getFurnitureByCategory,
  getFurnitureById,
  getFurnitureCategoryLabel,
  isValidFurnitureCatalogItem,
} from '@/data/furnitureCatalog.js';

const CATEGORY_IDS = new Set(FURNITURE_CATEGORIES.map((c) => c.id));

describe('furnitureCatalog', () => {
  it('defines the six starter categories', () => {
    expect(FURNITURE_CATEGORIES.map((c) => c.id)).toEqual([
      'seating',
      'tables',
      'storage',
      'beds',
      'lighting',
      'decor',
    ]);
  });

  it('includes at least eight starter items with required fields', () => {
    expect(STARTER_FURNITURE_CATALOG.length).toBeGreaterThanOrEqual(8);
    for (const item of STARTER_FURNITURE_CATALOG) {
      expect(isValidFurnitureCatalogItem(item)).toBe(true);
    }
    const ids = STARTER_FURNITURE_CATALOG.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('assigns every item category to FURNITURE_CATEGORIES', () => {
    for (const item of STARTER_FURNITURE_CATALOG) {
      expect(CATEGORY_IDS.has(item.category)).toBe(true);
    }
  });

  it('getFurnitureCategoryLabel returns labels for known categories', () => {
    expect(getFurnitureCategoryLabel('seating')).toBe('Seating');
    expect(getFurnitureCategoryLabel('tables')).toBe('Tables');
    expect(getFurnitureCategoryLabel('unknown-category')).toBe('unknown-category');
  });

  it('getFurnitureByCategory filters by category id', () => {
    const seating = getFurnitureByCategory('seating');
    expect(seating.length).toBeGreaterThanOrEqual(1);
    expect(seating.every((item) => item.category === 'seating')).toBe(true);

    expect(getFurnitureByCategory('beds').some((item) => item.id === 'starter-queen-bed')).toBe(
      true,
    );
    expect(getFurnitureByCategory('nonexistent')).toEqual([]);
  });

  it('getFurnitureById finds items and returns null when missing', () => {
    const sofa = getFurnitureById('starter-sofa-3seat');
    expect(sofa).not.toBeNull();
    expect(sofa?.name).toBe('Starter 3-Seat Sofa');

    expect(getFurnitureById('missing-id')).toBeNull();
  });

  it('starter items with modelUrl use curated Kenney metadata', () => {
    const curated = STARTER_FURNITURE_CATALOG.filter((item) => item.modelUrl);
    expect(curated.length).toBe(STARTER_FURNITURE_CATALOG.length);

    for (const item of curated) {
      expect(item.modelStatus).toBe('curated');
      expect(item.modelUrl).toMatch(/^\/models\/kenney\/.+\.glb$/);
      expect(item.modelSourceType).toBe('kenney');
      expect(item.modelProvider).toBe('Kenney Furniture Kit');
      expect(item.modelLicense).toBe('CC0-1.0');
      expect(item.modelAttribution).toBe('Kenney');
      expect(typeof item.verifiedScale).toBe('boolean');
    }
  });

  it('placeholder items remain valid when modelUrl is null', () => {
    const placeholder = {
      ...STARTER_FURNITURE_CATALOG[0],
      id: 'test-placeholder-only',
      modelUrl: null,
      modelStatus: 'placeholder',
      modelSourceType: undefined,
    };
    expect(isValidFurnitureCatalogItem(placeholder)).toBe(true);
    expect(placeholder.modelUrl).toBeNull();
    expect(placeholder.modelStatus).toBe('placeholder');
  });
});
