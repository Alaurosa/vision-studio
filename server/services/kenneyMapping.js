/**
 * Kenney Furniture Kit mapping module.
 *
 * Resolves a catalog item (by provider/provider_id, name, or category) to a
 * bundled Kenney GLB under `/models/kenney/`. The physical GLBs live in
 * `client/public/models/kenney/` so they're served from the client's own
 * static origin (no CORS, no third-party CDN cold-starts).
 *
 * Filenames follow the original Kenney camelCase convention
 * (e.g. `loungeSofa.glb`, `bedDouble.glb`, `cabinetTelevisionDoors.glb`).
 *
 * Usage:
 *   import { resolveModelUrl, nameToSlug, CATEGORY_DEFAULTS, PROVIDER_OVERRIDES } from './kenneyMapping.js';
 *   const url = resolveModelUrl({ provider: 'ikea', provider_id: 's49282816', name: 'KIVIK 3-seat sofa', category: 'sofa' });
 *   //=> '/models/kenney/loungeSofaLong.glb'
 *
 * Run standalone to verify every mapping points at a real file:
 *   node server/services/kenneyMapping.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Default GLB per catalog category.
 * All paths are public URLs served by the client's static host.
 */
export const CATEGORY_DEFAULTS = Object.freeze({
  sofa: '/models/kenney/loungeSofa.glb',
  sectional: '/models/kenney/loungeSofaCorner.glb',
  loveseat: '/models/kenney/loungeSofaOttoman.glb',
  bed: '/models/kenney/bedDouble.glb',
  chair: '/models/kenney/chairCushion.glb',
  armchair: '/models/kenney/loungeChair.glb',
  stool: '/models/kenney/stoolBar.glb',
  desk: '/models/kenney/desk.glb',
  table: '/models/kenney/tableCoffee.glb',
  dining_table: '/models/kenney/table.glb',
  coffee_table: '/models/kenney/tableCoffee.glb',
  side_table: '/models/kenney/sideTable.glb',
  bookshelf: '/models/kenney/bookcaseOpen.glb',
  bookcase: '/models/kenney/bookcaseOpen.glb',
  dresser: '/models/kenney/cabinetBedDrawer.glb',
  nightstand: '/models/kenney/sideTableDrawers.glb',
  cabinet: '/models/kenney/bathroomCabinet.glb',
  tv_stand: '/models/kenney/cabinetTelevision.glb',
  tv: '/models/kenney/televisionModern.glb',
  rug: '/models/kenney/rugRectangle.glb',
  lamp: '/models/kenney/lampRoundFloor.glb',
  floor_lamp: '/models/kenney/lampRoundFloor.glb',
  table_lamp: '/models/kenney/lampRoundTable.glb',
  plant: '/models/kenney/pottedPlant.glb',
  bench: '/models/kenney/bench.glb',
  wardrobe: '/models/kenney/bookcaseClosedWide.glb',
  storage: '/models/kenney/cabinetBedDrawer.glb',
});

/**
 * Per-item overrides. Keyed by either:
 *   - `"{provider}:{provider_id}"` (both lowercased), OR
 *   - the catalog name slug (`nameToSlug(name)`).
 *
 * Both shapes are included for each known item so we match regardless of
 * which field the caller passes in.
 */
export const PROVIDER_OVERRIDES = Object.freeze({
  // ---------- IKEA: keyed by provider:provider_id ----------
  'ikea:s49282816': '/models/kenney/loungeSofaLong.glb', // KIVIK 3-seat sofa
  'ikea:s39280887': '/models/kenney/bedDouble.glb', // MALM Bed Frame (Queen)
  'ikea:s19180534': '/models/kenney/bedSingle.glb', // HEMNES Bed Frame (Queen)
  'ikea:s0263832': '/models/kenney/bookcaseClosedDoors.glb', // BILLY Bookcase
  'ikea:s10275971': '/models/kenney/bookcaseOpenLow.glb', // KALLAX Shelf Unit (4x4)
  'ikea:s29281789': '/models/kenney/loungeChair.glb', // POÄNG Armchair
  'ikea:s29281971': '/models/kenney/chairModernFrameCushion.glb', // STRANDMON Wing Chair
  'ikea:s30173961': '/models/kenney/tableCoffeeSquare.glb', // LACK Coffee table
  'ikea:s99298433': '/models/kenney/cabinetTelevisionDoors.glb', // BESTÅ TV Unit
  'ikea:s80213074': '/models/kenney/deskCorner.glb', // MICKE Desk
  'ikea:s10176325': '/models/kenney/cabinetBedDrawer.glb', // HEMNES 8-drawer dresser

  // ---------- Ashley: keyed by provider:provider_id ----------
  'ashley:ash-7500138': '/models/kenney/loungeDesignSofa.glb', // Darcy Sofa
  'ashley:ash-1660038': '/models/kenney/loungeDesignSofa.glb', // Alenya Sofa
  'ashley:ash-d580-25': '/models/kenney/table.glb', // Owingsville Dining Table

  // ---------- IKEA: name-slug keys (match when provider_id isn't passed) ----------
  // KIVIK 3-seat sofa → "kivik-3-seat-sofa"
  'kivik-3-seat-sofa': '/models/kenney/loungeSofaLong.glb',
  'kivik-sofa': '/models/kenney/loungeSofa.glb',
  // KIVIK sofa corner (not yet in seed, but wired for future)
  'kivik-sofa-corner': '/models/kenney/loungeSofaCorner.glb',
  'kivik-corner-sofa': '/models/kenney/loungeSofaCorner.glb',
  'kivik-sectional': '/models/kenney/loungeSofaCorner.glb',
  // MALM bed frame variants → bedDouble
  'malm-bed-frame': '/models/kenney/bedDouble.glb',
  'malm-bed-frame-queen': '/models/kenney/bedDouble.glb',
  'malm-bed-frame-full': '/models/kenney/bedDouble.glb',
  'malm-bed-frame-king': '/models/kenney/bedDouble.glb',
  // HEMNES bed frame variants → bedSingle
  'hemnes-bed-frame': '/models/kenney/bedSingle.glb',
  'hemnes-bed-frame-queen': '/models/kenney/bedSingle.glb',
  'hemnes-bed-frame-full': '/models/kenney/bedSingle.glb',
  // BILLY bookcase
  'billy-bookcase': '/models/kenney/bookcaseClosedDoors.glb',
  // KALLAX
  'kallax-shelf-unit': '/models/kenney/bookcaseOpenLow.glb',
  'kallax-shelf-unit-4x4': '/models/kenney/bookcaseOpenLow.glb',
  // POÄNG → slug is "po-ng-armchair" (non-ascii → dash); include both spellings
  'poang-armchair': '/models/kenney/loungeChair.glb',
  'po-ng-armchair': '/models/kenney/loungeChair.glb',
  // STRANDMON
  'strandmon-wing-chair': '/models/kenney/chairModernFrameCushion.glb',
  // LACK coffee table + side table
  'lack-coffee-table': '/models/kenney/tableCoffeeSquare.glb',
  'lack-side-table': '/models/kenney/sideTable.glb',
  // BESTÅ → slug is "best-tv-unit" (non-ascii → dash)
  'besta-tv-unit': '/models/kenney/cabinetTelevisionDoors.glb',
  'best-tv-unit': '/models/kenney/cabinetTelevisionDoors.glb',
  // BEKANT
  'bekant-desk': '/models/kenney/desk.glb',
  // MICKE
  'micke-desk': '/models/kenney/deskCorner.glb',
  // MARKUS
  'markus-office-chair': '/models/kenney/chairDesk.glb',
  // MALM 6-drawer dresser
  'malm-6-drawer-dresser': '/models/kenney/cabinetBedDrawerTable.glb',
  // HEMNES 8-drawer dresser
  'hemnes-8-drawer-dresser': '/models/kenney/cabinetBedDrawer.glb',

  // ---------- Ashley: name-slug keys ----------
  'darcy-sofa': '/models/kenney/loungeDesignSofa.glb',
  'alenya-sofa': '/models/kenney/loungeDesignSofa.glb',
  'owingsville-dining-table': '/models/kenney/table.glb',
  // Generic "Ashley <category>" catch-alls for any future Ashley items
  'ashley-sofa': '/models/kenney/loungeDesignSofa.glb',
  'ashley-sectional': '/models/kenney/loungeDesignSofaCorner.glb',
  'ashley-dining-table': '/models/kenney/table.glb',
  'ashley-dining-chair': '/models/kenney/chair.glb',
});

/**
 * Normalize a catalog item name into a stable slug.
 *   - lowercase
 *   - non-alphanumeric runs → single dash
 *   - trim leading/trailing dashes
 *
 * Matches the contract documented in tasks.md §2.1.
 */
export function nameToSlug(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Resolve a Kenney GLB URL for a catalog item.
 *
 * Resolution order:
 *   1. `{provider}:{provider_id}` override (both lowercased)
 *   2. `nameToSlug(name)` override
 *   3. `CATEGORY_DEFAULTS[category.toLowerCase()]`
 *   4. `null`
 */
export function resolveModelUrl({ provider, provider_id, name, category } = {}) {
  // 1. provider:provider_id
  if (provider && provider_id != null) {
    const key = `${String(provider).toLowerCase()}:${String(provider_id).toLowerCase()}`;
    if (PROVIDER_OVERRIDES[key]) return PROVIDER_OVERRIDES[key];
  }

  // 2. name slug
  if (name) {
    const slug = nameToSlug(name);
    if (slug && PROVIDER_OVERRIDES[slug]) return PROVIDER_OVERRIDES[slug];
  }

  // 3. category default
  if (category) {
    const cat = String(category).toLowerCase();
    if (CATEGORY_DEFAULTS[cat]) return CATEGORY_DEFAULTS[cat];
  }

  // 4. no match
  return null;
}

// ---------------------------------------------------------------------------
// Self-check guard: when invoked directly (`node server/services/kenneyMapping.js`)
// walk every mapping, stat the referenced file under client/public/models/kenney/,
// and exit non-zero if any are missing.
// ---------------------------------------------------------------------------
if (process.argv[1]?.endsWith('kenneyMapping.js')) {
  // Resolve the public model dir relative to this file so it works regardless
  // of the current working directory the script is launched from.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.resolve(here, '..', '..', 'client', 'public', 'models', 'kenney');

  const entries = [
    ...Object.entries(CATEGORY_DEFAULTS).map(([k, v]) => ({ source: 'CATEGORY_DEFAULTS', key: k, url: v })),
    ...Object.entries(PROVIDER_OVERRIDES).map(([k, v]) => ({ source: 'PROVIDER_OVERRIDES', key: k, url: v })),
  ];

  const missing = [];
  for (const entry of entries) {
    const fileName = entry.url.replace(/^\/models\/kenney\//, '');
    const abs = path.join(publicDir, fileName);
    if (!fs.existsSync(abs)) {
      missing.push({ ...entry, abs });
    }
  }

  const categoryCount = Object.keys(CATEGORY_DEFAULTS).length;
  const overrideCount = Object.keys(PROVIDER_OVERRIDES).length;

  console.log('Kenney mapping self-check');
  console.log('─'.repeat(60));
  console.log(`Public dir:          ${publicDir}`);
  console.log(`CATEGORY_DEFAULTS:   ${categoryCount} entries`);
  console.log(`PROVIDER_OVERRIDES:  ${overrideCount} entries`);
  console.log(`Total checked:       ${entries.length}`);
  console.log(`Missing files:       ${missing.length}`);

  if (missing.length > 0) {
    console.log('\nMissing mappings:');
    for (const m of missing) {
      console.log(`  ✗ [${m.source}] ${m.key} → ${m.url}`);
    }
    process.exit(1);
  }

  console.log('\n✓ All mappings resolve to real files.');
  process.exit(0);
}
