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
});
