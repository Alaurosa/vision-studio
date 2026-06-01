import { beforeEach, describe, expect, it } from 'vitest';
import { useLayoutStore, selectVisibleFurniture } from '@/store/layoutStore';

describe('selectVisibleFurniture', () => {
  const sofa = {
    id: 'pl-sofa',
    x_inches: 48,
    y_inches: 48,
    width: 84,
    depth: 36,
    height: 34,
    category: 'seating',
  };
  const table = {
    id: 'pl-table',
    x_inches: 200,
    y_inches: 200,
    width: 48,
    depth: 30,
    height: 18,
    category: 'tables',
  };

  beforeEach(() => {
    useLayoutStore.setState({
      furniture: [sofa, table],
      zones: [
        {
          id: 'zone-a',
          name: 'Living',
          bbox: [0, 0, 120, 120],
          width: 120,
          depth: 120,
        },
        {
          id: 'zone-b',
          name: 'Bedroom',
          bbox: [120, 0, 240, 180],
          width: 120,
          depth: 180,
        },
      ],
      activeZoneId: null,
    });
  });

  it('returns all furniture when no zone is active', () => {
    expect(selectVisibleFurniture(useLayoutStore.getState())).toEqual([sofa, table]);
    expect(useLayoutStore.getState().getVisibleFurniture()).toEqual([sofa, table]);
  });

  it('filters furniture to the active zone by center point', () => {
    useLayoutStore.setState({ activeZoneId: 'zone-a' });
    expect(selectVisibleFurniture(useLayoutStore.getState())).toEqual([sofa]);
    expect(useLayoutStore.getState().getVisibleFurniture()).toEqual([sofa]);
  });

  it('returns all furniture when activeZoneId does not match a zone', () => {
    useLayoutStore.setState({ activeZoneId: 'missing-zone' });
    expect(selectVisibleFurniture(useLayoutStore.getState())).toEqual([sofa, table]);
  });
});
