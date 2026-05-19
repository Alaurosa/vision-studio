import { describe, expect, it } from 'vitest';
import { STARTER_FURNITURE_CATALOG } from '@/data/furnitureCatalog';
import { filterStarterFurnitureCatalog } from '@/utils/furnitureCatalogFilters';

describe('filterStarterFurnitureCatalog', () => {
  it('returns all items when filters are empty', () => {
    expect(filterStarterFurnitureCatalog(STARTER_FURNITURE_CATALOG)).toHaveLength(
      STARTER_FURNITURE_CATALOG.length,
    );
  });

  it('filters by category id', () => {
    const beds = filterStarterFurnitureCatalog(STARTER_FURNITURE_CATALOG, {
      categoryId: 'beds',
    });
    expect(beds.every((item) => item.category === 'beds')).toBe(true);
    expect(beds.some((item) => item.id === 'starter-queen-bed')).toBe(true);
  });

  it('filters by case-insensitive search across tags and labels', () => {
    const results = filterStarterFurnitureCatalog(STARTER_FURNITURE_CATALOG, {
      searchQuery: 'LIVING',
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((item) => item.tags.includes('living room'))).toBe(true);
  });

  it('filters by furniture name', () => {
    const results = filterStarterFurnitureCatalog(STARTER_FURNITURE_CATALOG, {
      searchQuery: 'armchair',
    });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('starter-armchair');
  });

  it('filters by provider label', () => {
    const results = filterStarterFurnitureCatalog(STARTER_FURNITURE_CATALOG, {
      searchQuery: 'vision studio',
    });
    expect(results).toHaveLength(STARTER_FURNITURE_CATALOG.length);
  });

  it('filters by tag text', () => {
    const results = filterStarterFurnitureCatalog(STARTER_FURNITURE_CATALOG, {
      searchQuery: 'bedroom',
    });
    expect(results.some((item) => item.id === 'starter-queen-bed')).toBe(true);
    expect(results.some((item) => item.id === 'starter-dresser')).toBe(true);
    expect(results.some((item) => item.id === 'starter-sofa-3seat')).toBe(false);
  });

  it('applies category and search together', () => {
    const results = filterStarterFurnitureCatalog(STARTER_FURNITURE_CATALOG, {
      categoryId: 'tables',
      searchQuery: 'coffee',
    });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('starter-coffee-table');
  });

  it('handles items with missing tags', () => {
    const items = [{ ...STARTER_FURNITURE_CATALOG[0], tags: undefined }];
    expect(
      filterStarterFurnitureCatalog(items, { searchQuery: 'sofa' }),
    ).toHaveLength(1);
  });
});
