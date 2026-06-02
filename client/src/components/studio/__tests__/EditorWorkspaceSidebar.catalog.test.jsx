import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import EditorWorkspaceSidebar from '@/components/studio/EditorWorkspaceSidebar';
import { STARTER_FURNITURE_CATALOG } from '@/data/furnitureCatalog';
import { useLayoutStore } from '@/store/layoutStore';

const sample = STARTER_FURNITURE_CATALOG[0];

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useLayoutStore.setState({
    selectedCatalogItem: null,
    furniture: [],
    room: null,
  });
});

describe('EditorWorkspaceSidebar catalog selection', () => {
  it('shows placement hint when a catalog item is selected', () => {
    useLayoutStore.setState({ selectedCatalogItem: sample });
    render(<EditorWorkspaceSidebar />);

    expect(screen.getByText(/Click the canvas to place/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear selection/i })).toBeInTheDocument();
  });

  it('clears catalog selection from the sidebar', () => {
    useLayoutStore.setState({ selectedCatalogItem: sample });
    render(<EditorWorkspaceSidebar />);

    fireEvent.click(screen.getByRole('button', { name: /Clear selection/i }));
    expect(useLayoutStore.getState().selectedCatalogItem).toBeNull();
  });
});
