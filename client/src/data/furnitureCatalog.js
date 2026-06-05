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
 * @property {string[]} [roomTypes]  - room types this piece suits (see ROOM_TYPES)
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

/** Room types used for room-aware recommendations. */
export const ROOM_TYPES = Object.freeze(['living', 'bedroom', 'dining', 'office']);

/**
 * Map a room/zone name to a room type (or null when it can't be inferred).
 * Used so recommendations suit the room ("Bedroom" → beds, not dining tables).
 * @param {string | null | undefined} name
 * @returns {'living' | 'bedroom' | 'dining' | 'office' | null}
 */
export function matchRoomType(name) {
  const n = String(name || '').toLowerCase();
  if (!n) return null;
  if (/(bedroom|\bbed\b|primary|master|guest|nursery|kids?)/.test(n)) return 'bedroom';
  if (/(dining|dinette|breakfast)/.test(n)) return 'dining';
  if (/(office|study|\bwork\b|\bdesk\b)/.test(n)) return 'office';
  if (/(living|lounge|family|great room|\bden\b|sitting|\btv\b|media)/.test(n)) return 'living';
  return null;
}

/** Category → placeholder thumbnail (an SVG that always exists in /public). */
function categoryPreview(category) {
  return `/furniture/placeholders/${category}.svg`;
}

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
const STARTER_FURNITURE_CATALOG_RAW = [
  {
    id: 'starter-sofa-3seat',
    provider: 'vision-studio',
    name: 'Starter 3-Seat Sofa',
    category: 'seating',
    dimensions: { width: 84, depth: 36, height: 32, unit: 'in' },
    footprint: { width: 84, depth: 36, unit: 'in' },
    ...kenneyCuratedModel('loungeSofaLong.glb'),
    roomTypes: ['living'],
    tags: ['living room', 'sofa', 'starter', 'modern', 'cozy'],
    sourceUrl: null,
  },
  {
    id: 'starter-armchair',
    provider: 'vision-studio',
    name: 'Starter Armchair',
    category: 'seating',
    dimensions: { width: 32, depth: 34, height: 38, unit: 'in' },
    footprint: { width: 32, depth: 34, unit: 'in' },
    ...kenneyCuratedModel('loungeChair.glb'),
    roomTypes: ['living', 'office', 'bedroom'],
    tags: ['living room', 'chair', 'starter', 'cozy', 'compact'],
    sourceUrl: null,
  },
  {
    id: 'starter-coffee-table',
    provider: 'vision-studio',
    name: 'Starter Coffee Table',
    category: 'tables',
    dimensions: { width: 48, depth: 24, height: 18, unit: 'in' },
    footprint: { width: 48, depth: 24, unit: 'in' },
    ...kenneyCuratedModel('tableCoffee.glb'),
    roomTypes: ['living'],
    tags: ['living room', 'table', 'starter', 'minimal', 'modern', 'compact'],
    sourceUrl: null,
  },
  {
    id: 'starter-dining-table',
    provider: 'vision-studio',
    name: 'Starter Dining Table',
    category: 'tables',
    dimensions: { width: 72, depth: 36, height: 30, unit: 'in' },
    footprint: { width: 72, depth: 36, unit: 'in' },
    ...kenneyCuratedModel('table.glb'),
    roomTypes: ['dining'],
    tags: ['dining', 'table', 'starter', 'modern', 'neutral'],
    sourceUrl: null,
  },
  {
    id: 'starter-bookshelf',
    provider: 'vision-studio',
    name: 'Starter Bookshelf',
    category: 'storage',
    dimensions: { width: 32, depth: 12, height: 72, unit: 'in' },
    footprint: { width: 32, depth: 12, unit: 'in' },
    ...kenneyCuratedModel('bookcaseOpen.glb'),
    roomTypes: ['living', 'office'],
    tags: ['storage', 'shelf', 'starter', 'minimal', 'neutral', 'compact'],
    sourceUrl: null,
  },
  {
    id: 'starter-dresser',
    provider: 'vision-studio',
    name: 'Starter Dresser',
    category: 'storage',
    dimensions: { width: 60, depth: 18, height: 34, unit: 'in' },
    footprint: { width: 60, depth: 18, unit: 'in' },
    ...kenneyCuratedModel('cabinetBedDrawer.glb'),
    roomTypes: ['bedroom'],
    tags: ['bedroom', 'storage', 'starter', 'neutral', 'modern'],
    sourceUrl: null,
  },
  {
    id: 'starter-queen-bed',
    provider: 'vision-studio',
    name: 'Starter Queen Bed',
    category: 'beds',
    dimensions: { width: 60, depth: 80, height: 14, unit: 'in' },
    footprint: { width: 60, depth: 80, unit: 'in' },
    ...kenneyCuratedModel('bedDouble.glb'),
    roomTypes: ['bedroom'],
    tags: ['bedroom', 'bed', 'starter', 'cozy', 'neutral'],
    sourceUrl: null,
  },
  {
    id: 'starter-floor-lamp',
    provider: 'vision-studio',
    name: 'Starter Floor Lamp',
    category: 'lighting',
    dimensions: { width: 14, depth: 14, height: 62, unit: 'in' },
    footprint: { width: 14, depth: 14, unit: 'in' },
    ...kenneyCuratedModel('lampRoundFloor.glb'),
    roomTypes: ['living', 'bedroom', 'office', 'dining'],
    tags: ['lighting', 'lamp', 'starter', 'minimal', 'modern', 'compact'],
    sourceUrl: null,
  },
  {
    id: 'starter-area-rug',
    provider: 'vision-studio',
    name: 'Starter Area Rug',
    category: 'decor',
    dimensions: { width: 96, depth: 72, height: 0.5, unit: 'in' },
    footprint: { width: 96, depth: 72, unit: 'in' },
    ...kenneyCuratedModel('rugRectangle.glb'),
    roomTypes: ['living', 'bedroom', 'dining'],
    tags: ['decor', 'rug', 'starter', 'cozy', 'neutral'],
    sourceUrl: null,
  },
  {
    id: 'starter-single-bed',
    provider: 'vision-studio',
    name: 'Starter Single Bed',
    category: 'beds',
    dimensions: { width: 39, depth: 80, height: 14, unit: 'in' },
    footprint: { width: 39, depth: 80, unit: 'in' },
    ...kenneyCuratedModel('bedSingle.glb'),
    roomTypes: ['bedroom'],
    tags: ['bedroom', 'bed', 'single', 'starter', 'compact', 'neutral'],
    sourceUrl: null,
  },
  {
    id: 'starter-nightstand',
    provider: 'vision-studio',
    name: 'Starter Nightstand',
    category: 'storage',
    dimensions: { width: 20, depth: 16, height: 24, unit: 'in' },
    footprint: { width: 20, depth: 16, unit: 'in' },
    ...kenneyCuratedModel('sideTableDrawers.glb'),
    roomTypes: ['bedroom'],
    tags: ['bedroom', 'storage', 'nightstand', 'starter', 'compact'],
    sourceUrl: null,
  },
  {
    id: 'starter-desk',
    provider: 'vision-studio',
    name: 'Starter Desk',
    category: 'tables',
    dimensions: { width: 47, depth: 24, height: 29, unit: 'in' },
    footprint: { width: 47, depth: 24, unit: 'in' },
    ...kenneyCuratedModel('desk.glb'),
    roomTypes: ['office'],
    tags: ['office', 'desk', 'table', 'starter', 'modern', 'work'],
    sourceUrl: null,
  },
  {
    id: 'starter-desk-chair',
    provider: 'vision-studio',
    name: 'Starter Desk Chair',
    category: 'seating',
    dimensions: { width: 22, depth: 22, height: 36, unit: 'in' },
    footprint: { width: 22, depth: 22, unit: 'in' },
    ...kenneyCuratedModel('chairDesk.glb'),
    roomTypes: ['office'],
    tags: ['office', 'chair', 'desk chair', 'starter', 'compact', 'work'],
    sourceUrl: null,
  },
  {
    id: 'starter-dining-chair',
    provider: 'vision-studio',
    name: 'Starter Dining Chair',
    category: 'seating',
    dimensions: { width: 18, depth: 20, height: 34, unit: 'in' },
    footprint: { width: 18, depth: 20, unit: 'in' },
    ...kenneyCuratedModel('chair.glb'),
    roomTypes: ['dining'],
    tags: ['dining', 'chair', 'starter', 'compact', 'neutral'],
    sourceUrl: null,
  },
  {
    id: 'starter-tv-stand',
    provider: 'vision-studio',
    name: 'Starter TV Stand',
    category: 'storage',
    dimensions: { width: 55, depth: 16, height: 20, unit: 'in' },
    footprint: { width: 55, depth: 16, unit: 'in' },
    ...kenneyCuratedModel('cabinetTelevisionDoors.glb'),
    roomTypes: ['living'],
    tags: ['living room', 'storage', 'tv stand', 'media', 'starter', 'modern'],
    sourceUrl: null,
  },
  {
    id: 'starter-potted-plant',
    provider: 'vision-studio',
    name: 'Starter Potted Plant',
    category: 'decor',
    dimensions: { width: 16, depth: 16, height: 28, unit: 'in' },
    footprint: { width: 16, depth: 16, unit: 'in' },
    ...kenneyCuratedModel('pottedPlant.glb'),
    roomTypes: ['living', 'bedroom', 'office', 'dining'],
    tags: ['decor', 'plant', 'greenery', 'starter', 'cozy'],
    sourceUrl: null,
  },
];

/**
 * Public starter catalog. Every item's preview points at its category SVG in
 * /public/furniture/placeholders so cards always show a real thumbnail.
 * @type {FurnitureCatalogItem[]}
 */
export const STARTER_FURNITURE_CATALOG = STARTER_FURNITURE_CATALOG_RAW.map((item) => ({
  ...item,
  previewImageUrl: categoryPreview(item.category),
}));

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
