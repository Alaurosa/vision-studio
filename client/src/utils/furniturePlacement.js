import { CATEGORY_COLORS, GRID_SNAP_INCHES } from '@/utils/constants';
import { getRotatedBoundingBox, snapToGrid } from '@/utils/scale';

export function newCatalogPlacementId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {import('@/data/furnitureCatalog.js').FurnitureCatalogItem} catalogItem
 */
export function getFurnitureFootprintSize(catalogItem) {
  const fp = catalogItem?.footprint;
  if (fp && typeof fp.width === 'number' && typeof fp.depth === 'number') {
    return { width: fp.width, depth: fp.depth };
  }
  const d = catalogItem?.dimensions;
  return {
    width: typeof d?.width === 'number' ? d.width : 24,
    depth: typeof d?.depth === 'number' ? d.depth : 24,
  };
}

/**
 * Build a placed furniture instance from a catalog template (does not mutate template).
 * Uses x_inches / y_inches as top-left of axis-aligned bbox (rotation 0), matching FurnitureItem + collision.
 *
 * @param {import('@/data/furnitureCatalog.js').FurnitureCatalogItem} catalogItem
 * @param {{ x_inches: number, y_inches: number }} positionInches click/center position in room coordinates
 * @param {{ center?: boolean, rotation?: number }} [options]
 */
export function createPlacedFurnitureFromCatalogItem(catalogItem, positionInches, options = {}) {
  const { center = true, rotation = 0 } = options;
  const { width, depth } = getFurnitureFootprintSize(catalogItem);
  const height =
    catalogItem.dimensions && typeof catalogItem.dimensions.height === 'number'
      ? catalogItem.dimensions.height
      : 36;

  let x_inches = positionInches.x_inches;
  let y_inches = positionInches.y_inches;

  if (center) {
    const bbox = getRotatedBoundingBox(width, depth, rotation);
    x_inches -= bbox.width / 2;
    y_inches -= bbox.depth / 2;
  }

  x_inches = snapToGrid(x_inches, GRID_SNAP_INCHES);
  y_inches = snapToGrid(y_inches, GRID_SNAP_INCHES);

  const id = newCatalogPlacementId();
  const color = CATEGORY_COLORS[catalogItem.category] || CATEGORY_COLORS.default;

  return {
    id,
    catalogItemId: catalogItem.id,
    catalog_id: null,
    provider: catalogItem.provider,
    provider_id: catalogItem.id,
    name: catalogItem.name,
    category: catalogItem.category,
    width,
    depth,
    height,
    x_inches,
    y_inches,
    x: x_inches,
    y: y_inches,
    rotation,
    dimensions: {
      width: catalogItem.dimensions.width,
      depth: catalogItem.dimensions.depth,
      height: catalogItem.dimensions.height,
      unit: catalogItem.dimensions.unit,
    },
    footprint: {
      width: catalogItem.footprint.width,
      depth: catalogItem.footprint.depth,
      unit: catalogItem.footprint.unit,
    },
    previewImageUrl: catalogItem.previewImageUrl,
    image_url: catalogItem.previewImageUrl,
    modelUrl: catalogItem.modelUrl,
    model_url: catalogItem.modelUrl,
    modelStatus: catalogItem.modelStatus,
    modelSourceType: catalogItem.modelSourceType ?? null,
    modelProvider: catalogItem.modelProvider ?? null,
    modelLicense: catalogItem.modelLicense ?? null,
    modelAttribution: catalogItem.modelAttribution ?? null,
    verifiedScale: catalogItem.verifiedScale === true,
    model_rotation_y: catalogItem.modelRotationY ?? catalogItem.model_rotation_y ?? 0,
    tags: [...(catalogItem.tags || [])],
    sourceUrl: catalogItem.sourceUrl,
    color,
  };
}
