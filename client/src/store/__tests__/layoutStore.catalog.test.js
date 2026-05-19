import { beforeEach, describe, expect, it } from 'vitest';
import { STARTER_FURNITURE_CATALOG } from '@/data/furnitureCatalog';
import { useLayoutStore } from '@/store/layoutStore';
import { createPlacedFurnitureFromCatalogItem } from '@/utils/furniturePlacement';

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

  it('addFurniture adds a draft placement from a catalog template', async () => {
    useLayoutStore.setState({
      room: { id: 'draft-flow-test', name: 'Test Room', width: 240, depth: 180 },
      furniture: [],
      selectedCatalogItem: sample,
    });

    const placement = createPlacedFurnitureFromCatalogItem(sample, {
      x_inches: 48,
      y_inches: 36,
    });
    await useLayoutStore.getState().addFurniture(placement);

    const { furniture, selectedCatalogItem } = useLayoutStore.getState();
    expect(furniture).toHaveLength(1);
    expect(furniture[0].catalogItemId).toBe(sample.id);
    expect(furniture[0].name).toBe(sample.name);
    expect(selectedCatalogItem).toEqual(sample);
    expect(STARTER_FURNITURE_CATALOG[0]).toEqual(sample);
  });
});
