import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FurnitureCatalogPanel from '@/components/catalog/FurnitureCatalogPanel';
import { STARTER_FURNITURE_CATALOG } from '@/data/furnitureCatalog';

afterEach(() => {
  cleanup();
});

describe('catalog browsing flow (integration)', () => {
  it('searches, filters by category, and passes full item metadata on select', () => {
    const onSelectItem = vi.fn();
    const diningTable = STARTER_FURNITURE_CATALOG.find((item) => item.id === 'starter-dining-table');

    render(<FurnitureCatalogPanel onSelectItem={onSelectItem} />);

    fireEvent.change(screen.getByLabelText('Search furniture'), {
      target: { value: 'dining' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tables' }));

    expect(screen.getByText('1 piece')).toBeInTheDocument();
    expect(screen.getByText(diningTable.name)).toBeInTheDocument();
    expect(screen.queryByText('Starter Coffee Table')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: `Select ${diningTable.name}` }));

    expect(onSelectItem).toHaveBeenCalledTimes(1);
    expect(onSelectItem).toHaveBeenCalledWith(diningTable);
    expect(onSelectItem.mock.calls[0][0]).toMatchObject({
      id: diningTable.id,
      provider: diningTable.provider,
      category: diningTable.category,
      dimensions: diningTable.dimensions,
      footprint: diningTable.footprint,
      previewImageUrl: diningTable.previewImageUrl,
      modelStatus: diningTable.modelStatus,
      tags: diningTable.tags,
    });
  });
});
