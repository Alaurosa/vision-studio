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

function expandRecommendations() {
  fireEvent.click(screen.getByTestId('recommended-collapsible-trigger'));
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

  describe('Recommended for this room section', () => {
    it('renders a collapsed callout by default with the catalog visible', () => {
      setLayoutState({ room: { id: 'r1', width: 216, depth: 168 }, furniture: [] });

      render(<FurnitureCatalogPanel />);

      const trigger = screen.getByTestId('recommended-collapsible-trigger');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('recommended-collapsible-panel')).not.toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Furniture catalog results' })).toBeInTheDocument();
      expect(screen.getByText(/picks for this room/i)).toBeInTheDocument();
    });

    it('prompts to set room dimensions when expanded and the room is unknown', () => {
      render(<FurnitureCatalogPanel />);

      expect(screen.getByText(/room dimensions unknown/i)).toBeInTheDocument();
      expect(screen.getByText(/set room size to unlock/i)).toBeInTheDocument();
      expandRecommendations();
      expect(screen.getByTestId('recommended-empty-state')).toHaveTextContent(
        /set room dimensions/i,
      );
    });

    it('expands to show recommendations while keeping the catalog below', () => {
      setLayoutState({ room: { id: 'r1', width: 216, depth: 168 }, furniture: [] });

      render(<FurnitureCatalogPanel />);
      expandRecommendations();

      expect(screen.getByTestId('recommended-collapsible-trigger')).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expect(
        screen.getByRole('list', { name: 'Recommended furniture for this room' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Furniture catalog results' })).toBeInTheDocument();
    });

    it('shows cross-category picks without requiring a category filter', () => {
      setLayoutState({ room: { id: 'r1', width: 216, depth: 168 }, furniture: [] });

      render(<FurnitureCatalogPanel />);
      expandRecommendations();

      const recList = screen.getByRole('list', { name: 'Recommended furniture for this room' });
      const recButtons = within(recList).getAllByRole('button');
      expect(recButtons.length).toBeGreaterThan(0);
      expect(recButtons.length).toBeLessThanOrEqual(5);
    });

    it('shows an empty recommended state for categories with no fits', () => {
      setLayoutState({ room: { id: 'r1', width: 96, depth: 96 }, furniture: [] });

      render(<FurnitureCatalogPanel />);
      fireEvent.click(screen.getByRole('button', { name: 'Tables' }));
      expandRecommendations();

      expect(screen.getByTestId('recommended-empty-state')).toHaveTextContent(/no pieces fit/i);
    });

    it('shows reasons under recommended items when expanded', () => {
      setLayoutState({ room: { id: 'r1', width: 216, depth: 168 }, furniture: [] });

      render(<FurnitureCatalogPanel />);
      fireEvent.click(screen.getByRole('button', { name: 'Storage' }));
      expandRecommendations();

      const reason = screen.getByTestId('recommendation-reason-starter-bookshelf');
      expect(reason).toBeInTheDocument();
      expect(reason.textContent || '').toMatch(/fits/i);
    });

    it('renders metrics summary (room bucket + open area) when expanded', () => {
      setLayoutState({ room: { id: 'r1', width: 216, depth: 168 }, furniture: [] });

      render(<FurnitureCatalogPanel />);
      fireEvent.click(screen.getByRole('button', { name: 'Storage' }));
      expandRecommendations();

      const metrics = screen.getByTestId('recommendation-metrics');
      expect(metrics).toBeInTheDocument();
      expect(metrics.textContent || '').toMatch(/medium|large/i);
      expect(metrics.textContent || '').toMatch(/open area/i);
    });

    it('uses available space — placing a blocker shrinks recommendations', () => {
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
      expandRecommendations();

      const recPanel = screen.getByTestId('recommended-collapsible-panel');
      expect(within(recPanel).queryByText('Starter 3-Seat Sofa')).not.toBeInTheDocument();
    });

    it('filters catalog and recommendations by style tag', () => {
      setLayoutState({ room: { id: 'r1', width: 216, depth: 168 }, furniture: [] });

      render(<FurnitureCatalogPanel />);
      fireEvent.click(screen.getByRole('button', { name: 'Minimal' }));
      expandRecommendations();

      const browseList = screen.getByRole('list', { name: 'Furniture catalog results' });
      expect(within(browseList).getByText('Starter Coffee Table')).toBeInTheDocument();
      expect(within(browseList).queryByText('Starter 3-Seat Sofa')).not.toBeInTheDocument();

      const recPanel = screen.getByTestId('recommended-collapsible-panel');
      expect(within(recPanel).getByText(/minimal/i)).toBeInTheDocument();
    });

    it('keeps search enabled while recommendations are collapsed', () => {
      setLayoutState({ room: { id: 'r1', width: 216, depth: 168 }, furniture: [] });

      render(<FurnitureCatalogPanel />);

      const search = screen.getByLabelText('Search furniture');
      expect(search).not.toBeDisabled();
      fireEvent.change(search, { target: { value: 'queen' } });
      const browseList = screen.getByRole('list', { name: 'Furniture catalog results' });
      expect(within(browseList).getByText('Starter Queen Bed')).toBeInTheDocument();
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
