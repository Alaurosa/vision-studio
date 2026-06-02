import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import FurnitureCatalogPanel from '@/components/catalog/FurnitureCatalogPanel';
import { STARTER_FURNITURE_CATALOG } from '@/data/furnitureCatalog';
import { useLayoutStore } from '@/store/layoutStore';

// Snapshot the initial layoutStore state so each test can reset cleanly.
const INITIAL_LAYOUT_STATE = useLayoutStore.getState();

function setLayoutState(patch) {
  useLayoutStore.setState(patch, false);
}

beforeEach(() => {
  useLayoutStore.setState(INITIAL_LAYOUT_STATE, true);
});

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

  describe('Recommended mode', () => {
    it('disables the toggle when room dimensions are unknown', () => {
      render(<FurnitureCatalogPanel />);

      const toggle = screen.getByRole('button', { name: /^Recommended/ });
      expect(toggle).toBeDisabled();
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByText(/room dimensions unknown/i)).toBeInTheDocument();
    });

    it('enables the toggle and shows the room label once dimensions are known', () => {
      setLayoutState({ room: { id: 'r1', width: 216, depth: 168 }, furniture: [] });

      render(<FurnitureCatalogPanel />);

      const toggle = screen.getByRole('button', { name: /^Recommended/ });
      expect(toggle).not.toBeDisabled();
      // 216" = 18.0', 168" = 14.0'
      expect(screen.getByText(/18\.0'.*14\.0'/)).toBeInTheDocument();
    });

    it('prompts for a category when toggle is on and no category is selected', () => {
      setLayoutState({ room: { id: 'r1', width: 216, depth: 168 }, furniture: [] });

      render(<FurnitureCatalogPanel />);
      fireEvent.click(screen.getByRole('button', { name: /^Recommended/ }));

      expect(screen.getByText(/pick a category to see recommendations/i)).toBeInTheDocument();
      expect(
        screen.queryByRole('list', { name: 'Furniture catalog results' }),
      ).not.toBeInTheDocument();
    });

    it('filters the list to rule-based recommendations once a category is chosen', () => {
      // 96" × 96" = 64 sq ft → tiny. The Starter Queen Bed (60×80) actually
      // fits geometrically, but the bed-in-tiny rule is gentle (only kings
      // are excluded), so we instead test the Tables category: a tiny room
      // should drop the Dining Table but keep the Coffee Table only when a
      // sofa exists. Here there's no sofa, so both tables drop out.
      setLayoutState({ room: { id: 'r1', width: 96, depth: 96 }, furniture: [] });

      render(<FurnitureCatalogPanel />);
      fireEvent.click(screen.getByRole('button', { name: /^Recommended/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Tables' }));

      // No tables should be recommended in a tiny, empty room.
      expect(screen.getByText(/no items fit this category right now/i)).toBeInTheDocument();
    });

    it('shows reasons under recommended items', () => {
      setLayoutState({ room: { id: 'r1', width: 216, depth: 168 }, furniture: [] });

      render(<FurnitureCatalogPanel />);
      fireEvent.click(screen.getByRole('button', { name: /^Recommended/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Storage' }));

      const reason = screen.getByTestId('recommendation-reason-starter-bookshelf');
      expect(reason).toBeInTheDocument();
      expect(reason.textContent || '').toMatch(/fits/i);
    });

    it('renders metrics summary (room bucket + open area) in recommended mode', () => {
      setLayoutState({ room: { id: 'r1', width: 216, depth: 168 }, furniture: [] });

      render(<FurnitureCatalogPanel />);
      fireEvent.click(screen.getByRole('button', { name: /^Recommended/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Storage' }));

      const metrics = screen.getByTestId('recommendation-metrics');
      expect(metrics).toBeInTheDocument();
      expect(metrics.textContent || '').toMatch(/medium|large/i);
      expect(metrics.textContent || '').toMatch(/open area/i);
    });

    it('uses available space — placing a blocker shrinks recommendations', () => {
      // A 12'×12' room (144×144) with a giant 130×130 blocker leaves almost no
      // free area, so the 3-Seat Sofa should be excluded by the clearance rule.
      setLayoutState({
        room: { id: 'r1', width: 144, depth: 144 },
        furniture: [
          {
            id: 'blocker',
            name: 'Blocker',
            category: 'tables',
            width: 130,
            depth: 130,
            x_inches: 0,
            y_inches: 0,
            rotation: 0,
          },
        ],
      });

      render(<FurnitureCatalogPanel />);
      fireEvent.click(screen.getByRole('button', { name: /^Recommended/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Seating' }));

      expect(screen.queryByText('Starter 3-Seat Sofa')).not.toBeInTheDocument();
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
