/**
 * Simple style tags for starter-catalog recommendations and filtering.
 */

export const FURNITURE_STYLE_TAGS = [
  { id: 'modern', label: 'Modern' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'cozy', label: 'Cozy' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'compact', label: 'Compact' },
];

export const STYLE_TAG_IDS = new Set(FURNITURE_STYLE_TAGS.map((t) => t.id));

/** Footprint at or below this area (sq in) counts as compact-friendly. */
export const COMPACT_FOOTPRINT_MAX_SQ_IN = 32 * 36;

/**
 * @param {import('@/data/furnitureCatalog.js').FurnitureCatalogItem | { tags?: string[], footprint?: { width?: number, depth?: number }, dimensions?: { width?: number, depth?: number } }} item
 * @param {string} styleId
 */
export function itemHasStyleTag(item, styleId) {
  if (!item || !styleId) return false;
  const id = styleId.toLowerCase();
  const tags = (item.tags || []).map((t) => String(t).toLowerCase());
  if (tags.includes(id)) return true;

  if (id === 'compact') {
    const fp = item.footprint || item.dimensions;
    if (fp && typeof fp.width === 'number' && typeof fp.depth === 'number') {
      return fp.width * fp.depth <= COMPACT_FOOTPRINT_MAX_SQ_IN;
    }
  }

  return false;
}

export function getStyleTagLabel(styleId) {
  return FURNITURE_STYLE_TAGS.find((t) => t.id === styleId)?.label ?? styleId;
}
