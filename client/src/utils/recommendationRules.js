/**
 * Furniture recommendation rules.
 *
 * Pure module. Given a room, the current placements, and a target category,
 * returns a ranked list of catalog items that fit, along with explanatory reasons.
 *
 * Inputs and outputs are all in inches, matching the rest of the platform.
 *
 * Design constraints worth re-reading before touching this:
 *  - The codebase has two parallel category taxonomies: bucket categories used by
 *    the starter catalog ('seating', 'tables', 'storage', 'beds', 'lighting',
 *    'decor') and specific categories used by the server / chat tools / placement
 *    color map ('sofa', 'bed', 'desk', ...). This module accepts either.
 *  - Clearance budget reuses `MIN_CLEARANCE_IN` from constants.js (24") instead
 *    of redefining a walkway constant.
 *  - Occupancy math reuses `getAABB` from collision.js so rotation is handled
 *    the same way as the rest of the editor.
 */

import { itemHasStyleTag, getStyleTagLabel } from '@/data/furnitureStyleTags';
import { MIN_CLEARANCE_IN } from '@/utils/constants';
import { getAABB } from '@/utils/collision';

/**
 * Maps specific categories ('sofa', 'bed', ...) to starter-catalog buckets.
 * Used when the caller passes a specific category but the catalog is the
 * starter catalog (which only knows about buckets).
 */
export const SPECIFIC_TO_BUCKET = {
  sofa: 'seating',
  loveseat: 'seating',
  armchair: 'seating',
  chair: 'seating',
  coffee_table: 'tables',
  dining_table: 'tables',
  desk: 'tables',
  bookshelf: 'storage',
  dresser: 'storage',
  cabinet: 'storage',
  nightstand: 'storage',
  tv_stand: 'storage',
  bed: 'beds',
};

/**
 * Categories that need a wall to look right.
 * Used by the wall-reach hard rule.
 */
export const WALL_ANCHORED_CATEGORIES = new Set([
  'sofa',
  'bed',
  'beds',
  'bookshelf',
  'dresser',
  'tv_stand',
  'cabinet',
]);

/**
 * Categories that should normally appear at most once per room.
 * Used by the dedup hard rule.
 */
export const SINGLETON_CATEGORIES = new Set([
  'bed',
  'beds',
  'dining_table',
  'tv_stand',
  'desk',
]);

/**
 * Complementary pairings used by the soft scoring rule.
 * Key: concept being recommended; value: concepts whose presence boosts the score.
 */
export const COMPLEMENT_RULES = {
  coffee_table: ['sofa', 'armchair', 'loveseat'],
  nightstand: ['bed'],
  tv_stand: ['sofa', 'armchair'],
  chair: ['desk', 'dining_table'],
  armchair: ['sofa', 'tv_stand'],
};

/**
 * Room area buckets in square feet. Derived from ROOM_TEMPLATES in constants.js
 * (office=90, bedroom=132, dining=168, living=252, studio=300) so the buckets
 * line up with the templates the app already ships.
 */
export const ROOM_AREA_BUCKETS = [
  { id: 'tiny', maxSqFt: 80 },
  { id: 'small', maxSqFt: 130 },
  { id: 'medium', maxSqFt: 225 },
  { id: 'large', maxSqFt: Infinity },
];

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_ROOM_SECTION_MAX_RESULTS = 5;
const DEFAULT_PER_CATEGORY_PICKS = 1;
const OCCUPANCY_STEP_INCHES = 12;

/** Starter-catalog bucket ids used for cross-category room recommendations. */
export const ROOM_RECOMMENDATION_CATEGORY_IDS = [
  'seating',
  'tables',
  'storage',
  'beds',
  'lighting',
  'decor',
];

/**
 * @typedef {Object} RecommendationMetrics
 * @property {number} roomAreaSqIn
 * @property {number} roomAreaSqFt
 * @property {number} occupiedAreaSqIn
 * @property {number} freeAreaSqIn
 * @property {{ width: number, depth: number }} largestFreeRect
 */

/**
 * @typedef {Object} RecommendationEntry
 * @property {import('@/data/furnitureCatalog.js').FurnitureCatalogItem} item
 * @property {number} score
 * @property {string[]} reasons
 * @property {0 | 90} rotationHint  - 90 means the item must be rotated to fit
 */

/**
 * @typedef {Object} RecommendationResult
 * @property {string} category
 * @property {'tiny' | 'small' | 'medium' | 'large' | 'unknown'} roomBucket
 * @property {RecommendationMetrics | null} metrics
 * @property {RecommendationEntry[]} items
 */

/**
 * Compute room size bucket from area in square feet.
 */
export function computeRoomBucket(roomAreaSqFt) {
  if (!Number.isFinite(roomAreaSqFt) || roomAreaSqFt <= 0) return 'unknown';
  for (const bucket of ROOM_AREA_BUCKETS) {
    if (roomAreaSqFt < bucket.maxSqFt) return bucket.id;
  }
  return 'large';
}

/**
 * Standard "largest rectangle in histogram" (stack-based, O(n)).
 * Returns the largest area plus the width (in cells) and height (in cells)
 * of the rectangle that achieved it.
 */
function largestRectInHistogram(heights) {
  const stack = [];
  let best = { area: 0, width: 0, height: 0 };
  for (let i = 0; i <= heights.length; i++) {
    const h = i === heights.length ? 0 : heights[i];
    while (stack.length && heights[stack[stack.length - 1]] > h) {
      const top = stack.pop();
      const height = heights[top];
      const left = stack.length ? stack[stack.length - 1] : -1;
      const width = i - left - 1;
      const area = height * width;
      if (area > best.area) best = { area, width, height };
    }
    stack.push(i);
  }
  return best;
}

/**
 * Compute the largest free axis-aligned rectangle inside the room given current
 * placements. Uses a coarse occupancy grid (step = 12") and the standard
 * "maximum rectangle of 1s" algorithm.
 *
 * @returns {{ width: number, depth: number }} dimensions in inches; (0, 0) if the room is unknown
 */
export function computeLargestFreeRect(roomWidth, roomDepth, placements, step = OCCUPANCY_STEP_INCHES) {
  if (!(roomWidth > 0) || !(roomDepth > 0)) return { width: 0, depth: 0 };

  const cols = Math.max(1, Math.ceil(roomWidth / step));
  const rows = Math.max(1, Math.ceil(roomDepth / step));
  const grid = Array.from({ length: rows }, () => new Uint8Array(cols));

  for (const p of placements || []) {
    if (!p) continue;
    const box = getAABB(p);
    if (!isFinite(box.left)) continue;
    const c0 = Math.max(0, Math.floor(box.left / step));
    const c1 = Math.min(cols, Math.ceil(box.right / step));
    const r0 = Math.max(0, Math.floor(box.top / step));
    const r1 = Math.min(rows, Math.ceil(box.bottom / step));
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        grid[r][c] = 1;
      }
    }
  }

  const heights = new Array(cols).fill(0);
  let bestCols = 0;
  let bestRows = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      heights[c] = grid[r][c] ? 0 : heights[c] + 1;
    }
    const result = largestRectInHistogram(heights);
    if (result.area > bestCols * bestRows) {
      bestCols = result.width;
      bestRows = result.height;
    }
  }

  // Clamp to the actual room dimensions — the grid quantization can otherwise
  // round the rectangle slightly larger than the room.
  return {
    width: Math.min(roomWidth, bestCols * step),
    depth: Math.min(roomDepth, bestRows * step),
  };
}

function getFootprint(item) {
  const fp = item?.footprint;
  if (fp && typeof fp.width === 'number' && typeof fp.depth === 'number') {
    return { width: fp.width, depth: fp.depth };
  }
  const d = item?.dimensions;
  if (d && typeof d.width === 'number' && typeof d.depth === 'number') {
    return { width: d.width, depth: d.depth };
  }
  if (typeof item?.width === 'number' && typeof item?.depth === 'number') {
    return { width: item.width, depth: item.depth };
  }
  return { width: 0, depth: 0 };
}

/**
 * Does this item match a concept like 'sofa' / 'bed' / 'desk'?
 * Works across both taxonomies:
 *  - server catalog: item.category === concept
 *  - starter catalog: item.tags includes concept
 *  - bucket-only catalogs: concept's spaced form appears in the item name
 *    (e.g. "Starter Coffee Table" matches the 'coffee_table' concept)
 */
function matchesConcept(item, concept) {
  if (!item || !concept) return false;
  const conceptLower = concept.toLowerCase();
  if ((item.category || '').toLowerCase() === conceptLower) return true;

  const conceptSpaced = conceptLower.replace(/_/g, ' ');
  const tags = (item.tags || []).map((t) => String(t).toLowerCase());
  if (tags.includes(conceptLower) || tags.includes(conceptSpaced)) return true;
  if (tags.some((t) => t.includes(conceptSpaced))) return true;

  const name = (item.name || '').toLowerCase();
  if (name.includes(conceptSpaced)) return true;
  return false;
}

/**
 * Filter catalog items down to "could plausibly be in this category".
 * Accepts either a bucket category ('seating') or a specific category ('sofa').
 */
function filterByCategory(catalog, category) {
  if (!category) return catalog.slice();
  const lc = category.toLowerCase();
  return catalog.filter((item) => {
    if ((item.category || '').toLowerCase() === lc) return true;
    if ((item.tags || []).some((t) => String(t).toLowerCase() === lc)) return true;
    // If the caller passes a specific category and the catalog only knows buckets,
    // fall back to matching the bucket.
    const bucket = SPECIFIC_TO_BUCKET[lc];
    if (bucket && (item.category || '').toLowerCase() === bucket) return true;
    return false;
  });
}

/**
 * Apply hard rules. Returns either `{ ok: true, rotationHint }` or `{ ok: false, reason }`.
 */
function passesHardRules({
  item,
  category,
  largestFreeRect,
  freeAreaSqIn,
  roomBucket,
  roomType,
  placements,
}) {
  const { width: fw, depth: fd } = getFootprint(item);
  if (!(fw > 0 && fd > 0)) {
    return { ok: false, reason: 'Item has no usable footprint' };
  }

  // Rule 0 — room-type appropriateness. When we know the room type and the item
  // is tagged for specific rooms, only surface it where it belongs (no dining
  // tables in a bedroom). Untagged items (e.g. server catalog) are always allowed.
  if (
    roomType &&
    Array.isArray(item.roomTypes) &&
    item.roomTypes.length > 0 &&
    !item.roomTypes.includes(roomType)
  ) {
    return { ok: false, reason: `Better suited to a ${item.roomTypes[0]} room` };
  }

  // Rule 1 — footprint fit (try rotation as a fallback)
  const fitsAsIs = fw <= largestFreeRect.width && fd <= largestFreeRect.depth;
  const fitsRotated = fd <= largestFreeRect.width && fw <= largestFreeRect.depth;
  if (!fitsAsIs && !fitsRotated) {
    return {
      ok: false,
      reason: `Needs ${fw}"×${fd}" of free space; largest open area is only ${largestFreeRect.width}"×${largestFreeRect.depth}"`,
    };
  }
  const rotationHint = fitsAsIs ? 0 : 90;
  const effW = fitsAsIs ? fw : fd;
  const effD = fitsAsIs ? fd : fw;

  // Rule 2 — wall reach for wall-anchored categories.
  // Approximation: longest available wall ≈ longest side of the largest free rectangle.
  const isWallAnchored =
    WALL_ANCHORED_CATEGORIES.has((category || '').toLowerCase()) ||
    WALL_ANCHORED_CATEGORIES.has((item.category || '').toLowerCase()) ||
    (item.tags || []).some((t) => WALL_ANCHORED_CATEGORIES.has(String(t).toLowerCase()));
  if (isWallAnchored) {
    const longestWall = Math.max(largestFreeRect.width, largestFreeRect.depth);
    if (effW > longestWall) {
      return {
        ok: false,
        reason: `Needs ${effW}" of clear wall; longest available run is ${longestWall}"`,
      };
    }
  }

  // Rule 3 — clearance budget: footprint + a 24" walkway along the front edge.
  const clearanceBudget = effW * effD + MIN_CLEARANCE_IN * effW;
  if (clearanceBudget > freeAreaSqIn) {
    return {
      ok: false,
      reason: `No room for walkway clearance (needs ~${Math.round(clearanceBudget)} sq in incl. ${MIN_CLEARANCE_IN}" walkway)`,
    };
  }

  // Rule 4 — category appropriateness by room area.
  if (matchesConcept(item, 'dining_table') && roomBucket === 'tiny') {
    return { ok: false, reason: 'Dining tables need at least a small-sized room' };
  }
  if (matchesConcept(item, 'bed') && fw >= 76 && (roomBucket === 'tiny' || roomBucket === 'small')) {
    return { ok: false, reason: 'King-size beds are too large for this room' };
  }
  if (matchesConcept(item, 'sofa') && fw >= 84 && roomBucket === 'tiny') {
    return { ok: false, reason: '3-seat / sectional sofas are too large for a tiny room' };
  }
  if (matchesConcept(item, 'tv_stand') && roomBucket === 'tiny') {
    return { ok: false, reason: 'TV stands are typically skipped in tiny rooms' };
  }

  // Companion requirements (don't recommend a coffee table when there's no seating, etc.)
  if (matchesConcept(item, 'coffee_table')) {
    const hasSeating = (placements || []).some(
      (p) => matchesConcept(p, 'sofa') || matchesConcept(p, 'armchair') || matchesConcept(p, 'loveseat'),
    );
    if (!hasSeating) return { ok: false, reason: 'Add a sofa or armchair first — coffee tables need a seating anchor' };
  }
  if (matchesConcept(item, 'nightstand')) {
    const hasBed = (placements || []).some((p) => matchesConcept(p, 'bed'));
    if (!hasBed) return { ok: false, reason: 'Add a bed first — nightstands belong beside one' };
  }

  // Rule 5 — dedup for "usually one per room" categories.
  if (isSingletonConcept(item)) {
    const concept = primaryConcept(item);
    if (concept && (placements || []).some((p) => matchesConcept(p, concept))) {
      return { ok: false, reason: `You already have a ${concept.replace(/_/g, ' ')} in this room` };
    }
  }

  return { ok: true, rotationHint };
}

function isSingletonConcept(item) {
  return (
    SINGLETON_CATEGORIES.has((item.category || '').toLowerCase()) ||
    (item.tags || []).some((t) => SINGLETON_CATEGORIES.has(String(t).toLowerCase()))
  );
}

function primaryConcept(item) {
  const cat = (item.category || '').toLowerCase();
  // 1. Server-catalog items already use the specific concept as category.
  if (cat && SPECIFIC_TO_BUCKET[cat] !== undefined) {
    return cat;
  }
  // 2. Starter-catalog items are named after their specific concept; prefer the
  // name match over the (sometimes-too-broad) tags before falling back to tags.
  const name = (item.name || '').toLowerCase();
  for (const specific of Object.keys(SPECIFIC_TO_BUCKET)) {
    const spaced = specific.replace(/_/g, ' ');
    if (name.includes(spaced)) return specific;
  }
  // 3. Tag match (e.g. provider-tagged items).
  for (const tag of item.tags || []) {
    const t = String(tag).toLowerCase();
    if (SPECIFIC_TO_BUCKET[t] !== undefined) return t;
  }
  // 4. Last resort: bucket category.
  return cat || null;
}

/**
 * Soft scoring (0..100). Higher is better.
 * Reasons are accumulated for the UI to render alongside the card.
 */
function scoreItem({
  item,
  rotationHint,
  largestFreeRect,
  placements,
  roomType,
  options,
}) {
  const reasons = [];
  let score = 0;

  if (roomType && Array.isArray(item.roomTypes) && item.roomTypes.includes(roomType)) {
    score += 15;
    reasons.push(`A natural fit for a ${roomType} room`);
  }

  const { width: fw, depth: fd } = getFootprint(item);
  const effW = rotationHint === 0 ? fw : fd;
  const effD = rotationHint === 0 ? fd : fw;

  if (rotationHint === 0) {
    score += 30;
    reasons.push(`Fits as-is in your ${largestFreeRect.width}"×${largestFreeRect.depth}" open area`);
  } else {
    score += 15;
    reasons.push(`Fits if rotated 90° in your ${largestFreeRect.width}"×${largestFreeRect.depth}" open area`);
  }

  const widthRatio = largestFreeRect.width > 0 ? effW / largestFreeRect.width : 1;
  if (widthRatio <= 0.6) {
    score += 20;
    reasons.push('Comfortable fit with plenty of breathing room');
  } else if (widthRatio >= 0.95) {
    score -= 10;
    reasons.push('Just barely fits — consider a smaller option');
  }

  const concept = primaryConcept(item);
  const complements = concept ? COMPLEMENT_RULES[concept] || [] : [];
  if (complements.length) {
    const pair = (placements || []).find((p) =>
      complements.some((c) => matchesConcept(p, c)),
    );
    if (pair) {
      score += 15;
      reasons.push(`Pairs with your ${pair.name || pair.category}`);
    }
  }

  const styleHint = (options?.styleHint || '').trim().toLowerCase();
  if (styleHint && itemHasStyleTag(item, styleHint)) {
    score += 10;
    const label = getStyleTagLabel(styleHint);
    reasons.push(
      styleHint === 'compact'
        ? 'Compact footprint — good for tighter layouts'
        : `Matches your ${label} style`,
    );
  }

  const providerHint = (options?.providerHint || '').trim().toLowerCase();
  if (providerHint && (item.provider || '').toLowerCase() === providerHint) {
    score += 5;
  }

  // Clamp to [0, 100] for a stable display range.
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return { score, reasons, effW, effD };
}

/**
 * Main entry point — produce ranked recommendations.
 *
 * @param {{
 *   room: { width?: number, depth?: number } | null | undefined,
 *   placements?: Array<object>,
 *   catalog: Array<import('@/data/furnitureCatalog.js').FurnitureCatalogItem>,
 *   category: string,
 *   options?: { styleHint?: string, providerHint?: string, maxResults?: number },
 * }} params
 * @returns {RecommendationResult}
 */
export function recommendFurniture({ room, placements = [], catalog = [], category, roomType = '', options = {} }) {
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;

  if (!category || typeof category !== 'string') {
    return {
      category: '',
      roomBucket: 'unknown',
      metrics: null,
      items: [],
    };
  }

  const roomWidth = Number(room?.width) || 0;
  const roomDepth = Number(room?.depth) || 0;
  const roomKnown = roomWidth > 0 && roomDepth > 0;

  // When we don't know the room, skip room-aware rules but still surface
  // category matches so the UI degrades gracefully.
  if (!roomKnown) {
    const candidates = filterByCategory(catalog, category);
    return {
      category,
      roomBucket: 'unknown',
      metrics: null,
      items: candidates.slice(0, maxResults).map((item) => ({
        item,
        score: 0,
        reasons: ['Room dimensions unknown — recommendations limited to category match'],
        rotationHint: 0,
      })),
    };
  }

  const roomAreaSqIn = roomWidth * roomDepth;
  const roomAreaSqFt = roomAreaSqIn / 144;
  const roomBucket = computeRoomBucket(roomAreaSqFt);

  let occupiedAreaSqIn = 0;
  for (const p of placements) {
    const box = getAABB(p);
    if (!isFinite(box.left)) continue;
    const w = Math.max(0, box.right - box.left);
    const d = Math.max(0, box.bottom - box.top);
    occupiedAreaSqIn += w * d;
  }
  const freeAreaSqIn = Math.max(0, roomAreaSqIn - occupiedAreaSqIn);
  const largestFreeRect = computeLargestFreeRect(roomWidth, roomDepth, placements);

  const metrics = {
    roomAreaSqIn,
    roomAreaSqFt,
    occupiedAreaSqIn,
    freeAreaSqIn,
    largestFreeRect,
  };

  const candidates = filterByCategory(catalog, category);

  /** @type {RecommendationEntry[]} */
  const entries = [];
  for (const item of candidates) {
    const verdict = passesHardRules({
      item,
      category,
      largestFreeRect,
      freeAreaSqIn,
      roomBucket,
      roomType,
      placements,
    });
    if (!verdict.ok) continue;

    const { score, reasons } = scoreItem({
      item,
      rotationHint: verdict.rotationHint,
      largestFreeRect,
      placements,
      roomType,
      options,
    });

    entries.push({ item, score, reasons, rotationHint: verdict.rotationHint });
  }

  entries.sort((a, b) => b.score - a.score);

  return {
    category,
    roomBucket,
    metrics,
    items: entries.slice(0, maxResults),
  };
}

/**
 * Room-level recommendations for the furniture panel section.
 * When no category is passed, takes the top pick from each bucket and merges
 * by score. When a category is passed, delegates to {@link recommendFurniture}.
 *
 * @param {{
 *   room: { width?: number, depth?: number } | null | undefined,
 *   placements?: Array<object>,
 *   catalog: Array<import('@/data/furnitureCatalog.js').FurnitureCatalogItem>,
 *   category?: string,
 *   options?: { maxResults?: number, perCategoryMax?: number, styleHint?: string, providerHint?: string },
 * }} params
 * @returns {Omit<RecommendationResult, 'category'> & { category?: string }}
 */
export function recommendForRoom({
  room,
  placements = [],
  catalog = [],
  category = '',
  roomType = '',
  options = {},
}) {
  const maxResults = options.maxResults ?? DEFAULT_ROOM_SECTION_MAX_RESULTS;

  if (category) {
    const result = recommendFurniture({
      room,
      placements,
      catalog,
      category,
      roomType,
      options: { ...options, maxResults },
    });
    return {
      category: result.category,
      roomBucket: result.roomBucket,
      metrics: result.metrics,
      items: result.items,
    };
  }

  const roomWidth = Number(room?.width) || 0;
  const roomDepth = Number(room?.depth) || 0;
  if (!(roomWidth > 0 && roomDepth > 0)) {
    return { roomBucket: 'unknown', metrics: null, items: [] };
  }

  const perCategoryMax = options.perCategoryMax ?? DEFAULT_PER_CATEGORY_PICKS;
  const seen = new Set();
  /** @type {RecommendationEntry[]} */
  const merged = [];
  let roomBucket = 'unknown';
  let metrics = null;

  for (const bucketId of ROOM_RECOMMENDATION_CATEGORY_IDS) {
    const result = recommendFurniture({
      room,
      placements,
      catalog,
      category: bucketId,
      roomType,
      options: { ...options, maxResults: perCategoryMax },
    });
    if (!metrics && result.metrics) {
      roomBucket = result.roomBucket;
      metrics = result.metrics;
    }
    for (const entry of result.items) {
      if (seen.has(entry.item.id)) continue;
      seen.add(entry.item.id);
      merged.push(entry);
    }
  }

  merged.sort((a, b) => b.score - a.score);

  return {
    roomBucket,
    metrics,
    items: merged.slice(0, maxResults),
  };
}
