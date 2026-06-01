/**
 * Starter furniture categories and catalog data for the editor catalog panel.
 * Import from here when building FurnitureCatalogPanel and placement wiring.
 */

/**
 * @typedef {Object} FurnitureDimensions
 * @property {number} width
 * @property {number} depth
 * @property {number} height
 * @property {'in'} unit
 */

/**
 * @typedef {Object} FurnitureFootprint
 * @property {number} width
 * @property {number} depth
 * @property {'in'} unit
 */

/**
 * @typedef {Object} FurnitureCatalogItem
 * @property {string} id
 * @property {string} provider
 * @property {string} name
 * @property {string} category
 * @property {FurnitureDimensions} dimensions
 * @property {FurnitureFootprint} footprint
 * @property {string | null} previewImageUrl
 * @property {string | null} modelUrl
 * @property {'placeholder' | 'curated' | 'generated' | 'missing'} modelStatus
 * @property {string} [modelSourceType]
 * @property {string} [modelProvider]
 * @property {string} [modelLicense]
 * @property {string} [modelAttribution]
 * @property {boolean} [verifiedScale]
 * @property {number} [modelRotationY]
 * @property {string[]} tags
 * @property {string | null} sourceUrl
 */

export const FURNITURE_CATEGORIES = [
  { id: 'seating', label: 'Seating' },
  { id: 'tables', label: 'Tables' },
  { id: 'storage', label: 'Storage' },
  { id: 'beds', label: 'Beds' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'decor', label: 'Decor' },
];

const CATEGORY_LABEL_BY_ID = Object.fromEntries(
  FURNITURE_CATEGORIES.map(({ id, label }) => [id, label]),
);

const KENNEY_MODEL_BASE = '/models/kenney';

/** Shared license metadata for bundled Kenney Furniture Kit GLBs (CC0). */
const KENNEY_SOURCE = Object.freeze({
  modelSourceType: 'kenney',
  modelProvider: 'Kenney Furniture Kit',
  modelLicense: 'CC0-1.0',
  modelAttribution: 'Kenney',
});

/**
 * @param {string} fileName Kenney GLB file name (e.g. loungeSofa.glb)
 * @param {{ modelRotationY?: number, verifiedScale?: boolean }} [options]
 */
export function kenneyCuratedModel(fileName, options = {}) {
  return {
    modelUrl: `${KENNEY_MODEL_BASE}/${fileName}`,
    modelStatus: 'curated',
    ...KENNEY_SOURCE,
    verifiedScale: options.verifiedScale === true,
    modelRotationY: options.modelRotationY ?? 0,
  };
}

/** @type {FurnitureCatalogItem[]} */
export const STARTER_FURNITURE_CATALOG = [
  {
    id: 'starter-sofa-3seat',
    provider: 'vision-studio',
    name: 'Starter 3-Seat Sofa',
    category: 'seating',
    dimensions: { width: 84, depth: 36, height: 32, unit: 'in' },
    footprint: { width: 84, depth: 36, unit: 'in' },
    previewImageUrl: '/furniture/placeholders/sofa.png',
    ...kenneyCuratedModel('loungeSofaLong.glb'),
    tags: ['living room', 'sofa', 'starter'],
    sourceUrl: null,
  },
  {
    id: 'starter-armchair',
    provider: 'vision-studio',
    name: 'Starter Armchair',
    category: 'seating',
    dimensions: { width: 32, depth: 34, height: 38, unit: 'in' },
    footprint: { width: 32, depth: 34, unit: 'in' },
    previewImageUrl: '/furniture/placeholders/sofa.png',
    ...kenneyCuratedModel('loungeChair.glb'),
    tags: ['living room', 'chair', 'starter'],
    sourceUrl: null,
  },
  {
    id: 'starter-coffee-table',
    provider: 'vision-studio',
    name: 'Starter Coffee Table',
    category: 'tables',
    dimensions: { width: 48, depth: 24, height: 18, unit: 'in' },
    footprint: { width: 48, depth: 24, unit: 'in' },
    previewImageUrl: '/furniture/placeholders/table.png',
    ...kenneyCuratedModel('tableCoffee.glb'),
    tags: ['living room', 'table', 'starter'],
    sourceUrl: null,
  },
  {
    id: 'starter-dining-table',
    provider: 'vision-studio',
    name: 'Starter Dining Table',
    category: 'tables',
    dimensions: { width: 72, depth: 36, height: 30, unit: 'in' },
    footprint: { width: 72, depth: 36, unit: 'in' },
    previewImageUrl: '/furniture/placeholders/table.png',
    ...kenneyCuratedModel('table.glb'),
    tags: ['dining', 'table', 'starter'],
    sourceUrl: null,
  },
  {
    id: 'starter-bookshelf',
    provider: 'vision-studio',
    name: 'Starter Bookshelf',
    category: 'storage',
    dimensions: { width: 32, depth: 12, height: 72, unit: 'in' },
    footprint: { width: 32, depth: 12, unit: 'in' },
    previewImageUrl: '/furniture/placeholders/table.png',
    ...kenneyCuratedModel('bookcaseOpen.glb'),
    tags: ['storage', 'shelf', 'starter'],
    sourceUrl: null,
  },
  {
    id: 'starter-dresser',
    provider: 'vision-studio',
    name: 'Starter Dresser',
    category: 'storage',
    dimensions: { width: 60, depth: 18, height: 34, unit: 'in' },
    footprint: { width: 60, depth: 18, unit: 'in' },
    previewImageUrl: '/furniture/placeholders/table.png',
    ...kenneyCuratedModel('cabinetBedDrawer.glb'),
    tags: ['bedroom', 'storage', 'starter'],
    sourceUrl: null,
  },
  {
    id: 'starter-queen-bed',
    provider: 'vision-studio',
    name: 'Starter Queen Bed',
    category: 'beds',
    dimensions: { width: 60, depth: 80, height: 14, unit: 'in' },
    footprint: { width: 60, depth: 80, unit: 'in' },
    previewImageUrl: '/furniture/placeholders/bed.png',
    ...kenneyCuratedModel('bedDouble.glb'),
    tags: ['bedroom', 'bed', 'starter'],
    sourceUrl: null,
  },
  {
    id: 'starter-floor-lamp',
    provider: 'vision-studio',
    name: 'Starter Floor Lamp',
    category: 'lighting',
    dimensions: { width: 14, depth: 14, height: 62, unit: 'in' },
    footprint: { width: 14, depth: 14, unit: 'in' },
    previewImageUrl: '/furniture/placeholders/table.png',
    ...kenneyCuratedModel('lampRoundFloor.glb'),
    tags: ['lighting', 'lamp', 'starter'],
    sourceUrl: null,
  },
  {
    id: 'starter-area-rug',
    provider: 'vision-studio',
    name: 'Starter Area Rug',
    category: 'decor',
    dimensions: { width: 96, depth: 72, height: 0.5, unit: 'in' },
    footprint: { width: 96, depth: 72, unit: 'in' },
    previewImageUrl: '/furniture/placeholders/table.png',
    ...kenneyCuratedModel('rugRectangle.glb'),
    tags: ['decor', 'rug', 'starter'],
    sourceUrl: null,
  },
];

const MODEL_STATUSES = new Set(['placeholder', 'curated', 'generated', 'missing']);

export function getFurnitureCategoryLabel(categoryId) {
  return CATEGORY_LABEL_BY_ID[categoryId] ?? categoryId;
}

export function getFurnitureByCategory(categoryId) {
  return STARTER_FURNITURE_CATALOG.filter((item) => item.category === categoryId);
}

export function getFurnitureById(furnitureId) {
  return STARTER_FURNITURE_CATALOG.find((item) => item.id === furnitureId) ?? null;
}

/** @internal Used by tests to validate catalog shape. */
export function isValidFurnitureCatalogItem(item) {
  if (!item || typeof item !== 'object') return false;

  const stringFields = ['id', 'provider', 'name', 'category'];
  if (!stringFields.every((key) => typeof item[key] === 'string' && item[key].length > 0)) {
    return false;
  }

  if (!MODEL_STATUSES.has(item.modelStatus)) return false;
  if (!Array.isArray(item.tags) || !item.tags.every((tag) => typeof tag === 'string')) {
    return false;
  }
  if (item.previewImageUrl !== null && typeof item.previewImageUrl !== 'string') return false;
  if (item.modelUrl !== null && typeof item.modelUrl !== 'string') return false;
  if (item.sourceUrl !== null && typeof item.sourceUrl !== 'string') return false;

  const { dimensions, footprint } = item;
  if (
    !dimensions ||
    dimensions.unit !== 'in' ||
    typeof dimensions.width !== 'number' ||
    typeof dimensions.depth !== 'number' ||
    typeof dimensions.height !== 'number'
  ) {
    return false;
  }

  if (
    !footprint ||
    footprint.unit !== 'in' ||
    typeof footprint.width !== 'number' ||
    typeof footprint.depth !== 'number'
  ) {
    return false;
  }

  return true;
}
