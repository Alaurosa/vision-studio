import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FurnitureCard from '@/components/catalog/FurnitureCard';
import { STARTER_FURNITURE_CATALOG } from '@/data/furnitureCatalog';

const sampleItem = STARTER_FURNITURE_CATALOG[0];

afterEach(() => {
  cleanup();
});

describe('FurnitureCard', () => {
  it('renders name, category label, dimensions, provider, and model status', () => {
    render(<FurnitureCard item={sampleItem} />);

    expect(screen.getByText(sampleItem.name)).toBeInTheDocument();
    expect(screen.getByText('Seating')).toBeInTheDocument();
    expect(
      screen.getByText(
        `${sampleItem.dimensions.width}" W × ${sampleItem.dimensions.depth}" D × ${sampleItem.dimensions.height}" H`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Vision Studio')).toBeInTheDocument();
    expect(screen.getByText('Placeholder model')).toBeInTheDocument();
  });

  it('shows preview placeholder when previewImageUrl is missing', () => {
    const item = { ...sampleItem, previewImageUrl: null };
    render(<FurnitureCard item={item} />);

    expect(screen.getByText('Preview coming soon')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows preview placeholder when the image fails to load', () => {
    const { container } = render(<FurnitureCard item={sampleItem} />);

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    fireEvent.error(img);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('Preview coming soon');
  });

  it('calls onSelect with the item when clicked', () => {
    const onSelect = vi.fn();
    render(<FurnitureCard item={sampleItem} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: `Select ${sampleItem.name}` }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(sampleItem);
  });

  it('marks the card as pressed when selected', () => {
    const { getByRole } = render(
      <FurnitureCard item={sampleItem} isSelected onSelect={() => {}} />,
    );

    expect(getByRole('button', { name: `Select ${sampleItem.name}` })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
