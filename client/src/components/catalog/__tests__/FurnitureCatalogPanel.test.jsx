import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import FurnitureCatalogPanel from '@/components/catalog/FurnitureCatalogPanel';
import { STARTER_FURNITURE_CATALOG } from '@/data/furnitureCatalog';

afterEach(() => {
  cleanup();
});

describe('FurnitureCatalogPanel', () => {
  it('renders starter furniture items', () => {
    render(<FurnitureCatalogPanel />);

    expect(screen.getByText('Furniture')).toBeInTheDocument();
    expect(screen.getByText('Browse starter pieces for your space.')).toBeInTheDocument();
    expect(screen.getByText(`${STARTER_FURNITURE_CATALOG.length} pieces`)).toBeInTheDocument();

    for (const item of STARTER_FURNITURE_CATALOG) {
      expect(screen.getByText(item.name)).toBeInTheDocument();
    }
  });

  it('filters items by search query (name)', () => {
    render(<FurnitureCatalogPanel />);

    fireEvent.change(screen.getByLabelText('Search furniture'), {
      target: { value: 'queen' },
    });

    expect(screen.getByText('Starter Queen Bed')).toBeInTheDocument();
    expect(screen.queryByText('Starter 3-Seat Sofa')).not.toBeInTheDocument();
    expect(screen.getByText('1 piece')).toBeInTheDocument();
  });

  it('filters items by provider search', () => {
    render(<FurnitureCatalogPanel />);

    fireEvent.change(screen.getByLabelText('Search furniture'), {
      target: { value: 'vision studio' },
    });

    expect(screen.getByText(`${STARTER_FURNITURE_CATALOG.length} pieces`)).toBeInTheDocument();
  });

  it('filters items by tag search', () => {
    render(<FurnitureCatalogPanel />);

    fireEvent.change(screen.getByLabelText('Search furniture'), {
      target: { value: 'lamp' },
    });

    expect(screen.getByText('Starter Floor Lamp')).toBeInTheDocument();
    expect(screen.getByText('1 piece')).toBeInTheDocument();
  });

  it('filters by category and search together', () => {
    render(<FurnitureCatalogPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Tables' }));
    fireEvent.change(screen.getByLabelText('Search furniture'), {
      target: { value: 'coffee' },
    });

    expect(screen.getByText('Starter Coffee Table')).toBeInTheDocument();
    expect(screen.queryByText('Starter Dining Table')).not.toBeInTheDocument();
    expect(screen.getByText('1 piece')).toBeInTheDocument();
  });

  it('filters items by category', () => {
    render(<FurnitureCatalogPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Seating' }));

    const list = screen.getByRole('list', { name: 'Furniture catalog results' });
    const items = within(list).getAllByRole('button');
    expect(items).toHaveLength(2);
    expect(screen.getByText('2 pieces')).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', () => {
    render(<FurnitureCatalogPanel />);

    fireEvent.change(screen.getByLabelText('Search furniture'), {
      target: { value: 'zzzz-no-match-zzzz' },
    });

    expect(screen.getByText('No furniture matches')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Furniture catalog results' })).not.toBeInTheDocument();
  });

  it('selects a furniture card locally and calls onSelectItem', () => {
    const onSelectItem = vi.fn();
    const sample = STARTER_FURNITURE_CATALOG[0];
    render(<FurnitureCatalogPanel onSelectItem={onSelectItem} />);

    const card = screen.getByRole('button', { name: `Select ${sample.name}` });
    fireEvent.click(card);

    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(onSelectItem).toHaveBeenCalledTimes(1);
    expect(onSelectItem).toHaveBeenCalledWith(sample);
    expect(onSelectItem.mock.calls[0][0]).toMatchObject({
      id: sample.id,
      dimensions: sample.dimensions,
      footprint: sample.footprint,
      modelStatus: sample.modelStatus,
      tags: sample.tags,
    });
  });

  it('uses controlled selectedItemId from the parent', () => {
    const sample = STARTER_FURNITURE_CATALOG[1];
    const { rerender } = render(
      <FurnitureCatalogPanel selectedItemId={sample.id} onSelectItem={() => {}} />,
    );

    expect(
      screen.getByRole('button', { name: `Select ${sample.name}` }),
    ).toHaveAttribute('aria-pressed', 'true');

    rerender(
      <FurnitureCatalogPanel
        selectedItemId={STARTER_FURNITURE_CATALOG[0].id}
        onSelectItem={() => {}}
      />,
    );

    expect(
      screen.getByRole('button', { name: `Select ${STARTER_FURNITURE_CATALOG[0].name}` }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
