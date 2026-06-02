import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import InteriorDesignPanel from '@/components/studio/InteriorDesignPanel';
import { useLayoutStore } from '@/store/layoutStore';

const INITIAL = useLayoutStore.getState();

beforeEach(() => {
  useLayoutStore.setState(INITIAL, true);
  useLayoutStore.setState({
    room: {
      id: 'draft-test',
      width: 180,
      depth: 144,
      height: 96,
      interior: {
        wallColor: '#f5f0e8',
        floorColor: '#ebe3d1',
        wallpaperId: null,
        wallArt: null,
        layoutIntent: 'balanced',
      },
    },
    furniture: [],
  });
});

afterEach(() => cleanup());

describe('InteriorDesignPanel', () => {
  it('updates wall color when a preset is clicked', () => {
    render(<InteriorDesignPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Sage' }));
    expect(useLayoutStore.getState().room.interior.wallColor).toBe('#d4ddd0');
  });

  it('shows layout guidance for the active intent', () => {
    render(<InteriorDesignPanel />);
    expect(screen.getByTestId('layout-guidance-panel')).toBeInTheDocument();
    expect(screen.getByText(/Layout guidance/i)).toBeInTheDocument();
  });
});
