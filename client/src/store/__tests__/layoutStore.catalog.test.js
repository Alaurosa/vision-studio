import { beforeEach, describe, expect, it } from 'vitest';
import { STARTER_FURNITURE_CATALOG } from '@/data/furnitureCatalog';
import { useLayoutStore } from '@/store/layoutStore';

const sample = STARTER_FURNITURE_CATALOG[0];

describe('layoutStore catalog selection', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      selectedCatalogItem: null,
    });
  });

  it('setSelectedCatalogItem stores the catalog template', () => {
    useLayoutStore.getState().setSelectedCatalogItem(sample);
    expect(useLayoutStore.getState().selectedCatalogItem).toEqual(sample);
  });

  it('clearSelectedCatalogItem clears selection', () => {
    useLayoutStore.getState().setSelectedCatalogItem(sample);
    useLayoutStore.getState().clearSelectedCatalogItem();
    expect(useLayoutStore.getState().selectedCatalogItem).toBeNull();
  });
});
