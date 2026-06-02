/**
 * Pure helpers for 3D furniture rendering (no React / Three.js imports).
 * Used by SmartFurnitureModel and RoomViewer3D.
 */

/** Inches → meters (matches RoomViewer3D). */
export const INCHES_TO_METERS = 0.0254;

/** Starter catalog categories → procedural model keys in ProceduralFurniture. */
export const STARTER_CATEGORY_TO_PROCEDURAL = Object.freeze({
  seating: 'sofa',
  tables: 'coffee_table',
  beds: 'bed',
  storage: 'cabinet',
  lighting: 'lamp',
  decor: 'decor',
});

const DEFAULT_DIMENSIONS_IN = Object.freeze({ width: 24, depth: 24, height: 30 });

/**
 * @param {object | null | undefined} item
 * @returns {string | null}
 */
export function resolveFurnitureModelUrl(item) {
  for (const key of ['model_url', 'modelUrl']) {
    const url = item?.[key];
    if (typeof url !== 'string') continue;
    const trimmed = url.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

/**
 * @param {object | null | undefined} item
 * @returns {boolean}
 */
export function shouldUseGlbModel(item) {
  return resolveFurnitureModelUrl(item) != null;
}

/**
 * Map catalog/API category to a ProceduralFurniture category key.
 * @param {object | null | undefined} item
 * @returns {string}
 */
export function resolveProceduralCategory(item) {
  const category = item?.category || '';
  const name = (item?.name || '').toLowerCase();

  if (STARTER_CATEGORY_TO_PROCEDURAL[category]) {
    const base = STARTER_CATEGORY_TO_PROCEDURAL[category];
    if (category === 'tables') {
      if (name.includes('dining')) return 'dining_table';
      if (name.includes('coffee')) return 'coffee_table';
      if (name.includes('desk')) return 'desk';
      return base;
    }
    if (category === 'storage') {
      if (name.includes('shelf') || name.includes('book')) return 'bookshelf';
      if (name.includes('dresser')) return 'dresser';
      return base;
    }
    if (category === 'seating') {
      if (name.includes('chair') && !name.includes('sofa')) return 'armchair';
      return base;
    }
    return base;
  }

  return category || 'unknown';
}

/**
 * Width/depth/height in inches from placement or catalog metadata.
 * @param {object | null | undefined} item
 * @returns {{ width: number, depth: number, height: number }}
 */
export function getFurnitureRenderDimensionsInches(item) {
  if (!item || typeof item !== 'object') {
    return { ...DEFAULT_DIMENSIONS_IN };
  }

  const width =
    typeof item.width === 'number'
      ? item.width
      : typeof item.footprint?.width === 'number'
        ? item.footprint.width
        : typeof item.dimensions?.width === 'number'
          ? item.dimensions.width
          : DEFAULT_DIMENSIONS_IN.width;

  const depth =
    typeof item.depth === 'number'
      ? item.depth
      : typeof item.footprint?.depth === 'number'
        ? item.footprint.depth
        : typeof item.dimensions?.depth === 'number'
          ? item.dimensions.depth
          : DEFAULT_DIMENSIONS_IN.depth;

  const height =
    typeof item.height === 'number'
      ? item.height
      : typeof item.dimensions?.height === 'number'
        ? item.dimensions.height
        : DEFAULT_DIMENSIONS_IN.height;

  return { width, depth, height };
}

/**
 * @param {{ width: number, depth: number, height: number }} dimensionsInches
 * @returns {{ w: number, d: number, h: number }}
 */
export function furnitureDimensionsToMeters(dimensionsInches) {
  const { width, depth, height } = dimensionsInches;
  return {
    w: width * INCHES_TO_METERS,
    d: depth * INCHES_TO_METERS,
    h: height * INCHES_TO_METERS,
  };
}

/**
 * @param {object | null | undefined} item
 * @returns {{ w: number, d: number, h: number }}
 */
export function getFurnitureRenderDimensionsMeters(item) {
  return furnitureDimensionsToMeters(getFurnitureRenderDimensionsInches(item));
}
