import { describe, expect, it } from 'vitest';
import { STARTER_FURNITURE_CATALOG } from '@/data/furnitureCatalog';
import {
  FURNITURE_STYLE_TAGS,
  STYLE_TAG_IDS,
  itemHasStyleTag,
} from '@/data/furnitureStyleTags';

describe('furnitureStyleTags', () => {
  it('defines the five starter style tags', () => {
    expect(FURNITURE_STYLE_TAGS.map((t) => t.id)).toEqual([
      'modern',
      'minimal',
      'cozy',
      'neutral',
      'compact',
    ]);
    expect(STYLE_TAG_IDS.size).toBe(5);
  });

  it('every catalog item has at least one style tag', () => {
    for (const item of STARTER_FURNITURE_CATALOG) {
      const hasStyle = FURNITURE_STYLE_TAGS.some((t) => itemHasStyleTag(item, t.id));
      expect(hasStyle).toBe(true);
    }
  });

  it('treats small footprints as compact even without an explicit tag', () => {
    const lamp = STARTER_FURNITURE_CATALOG.find((i) => i.id === 'starter-floor-lamp');
    expect(itemHasStyleTag(lamp, 'compact')).toBe(true);
  });
});
