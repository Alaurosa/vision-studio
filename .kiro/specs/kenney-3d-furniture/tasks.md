# Kenney 3D Furniture Integration — Tasks

> Replace the generic procedural 3D furniture boxes with real low-poly GLB models from Kenney's CC0 Furniture Kit. Keep `ProceduralFurniture` as a graceful fallback for any category that has no Kenney match.

## Approach (agreed)

- Source: [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) (CC0 / public domain, ~100 low-poly furniture pieces, GLB + OBJ).
- Hosting: bundle the `.glb` files directly into the repo under `client/public/models/kenney/` so they're served from the client's own static origin. No CORS, no third-party CDN cold-starts.
- Mapping: a single `kenneyMapping.js` module with category defaults + per-item overrides, shared by `seedFurniture.js`, `fallbackStore.js`, and (optionally) read at runtime by the client for on-the-fly resolution of catalog items that still have `model_url = null`.
- Loader: `SmartFurnitureModel.jsx` already prefers a real `model_url` and falls back to `ProceduralFurniture`. Minor tweaks to normalize Kenney scale/orientation (meters → inches, Y-up, facing -Z) so models render at each item's declared `width × depth × height`.

---

## Tasks

- [x] 1. Acquire Kenney Furniture Kit assets and add to the repo
  - [x] 1.1 Download the Kenney Furniture Kit GLB pack from https://kenney.nl/assets/furniture-kit (CC0).
  - [x] 1.2 Extract just the `.glb` files into `client/public/models/kenney/` (140 GLBs, flat, camelCase names like `loungeSofa.glb`, `bedDouble.glb`, `desk.glb`, `chairDesk.glb`, `cabinetBed.glb`, `cabinetTelevision.glb`, `bookcaseOpen.glb`).
  - [x] 1.3 Verified Vite serves them: `curl -I http://localhost:5173/models/kenney/bathroomCabinet.glb` → `200 OK` with `Content-Type: model/gltf-binary`.
  - [x] 1.4 Added "Credits / 3D Assets" section to `README.md` with Kenney CC0 attribution.

- [x] 2. Build the shared Kenney mapping module
  - [x] 2.1 Created `server/services/kenneyMapping.js` with `CATEGORY_DEFAULTS` (27 entries), `PROVIDER_OVERRIDES` (48 entries keyed by both `"{provider}:{provider_id}"` and name-slug), `resolveModelUrl()`, and `nameToSlug()` helper.
  - [x] 2.2 Self-check guard verified: `node server/services/kenneyMapping.js` → 75 entries checked, 0 missing, exit 0.

- [x] 3. Populate `model_url` in the server-side catalog sources
  - [x] 3.1 Updated `server/scripts/seedFurniture.js`: imports `resolveModelUrl`, maps every seed item, logs coverage summary. Result: 27/27 items resolved to a Kenney GLB, 0 nulls.
  - [x] 3.2 Updated `server/services/fallbackStore.js`: wraps the embedded array as `RAW_CATALOG`, derives `CATALOG` with `model_url = item.model_url || resolveModelUrl(item)`. Result: 26/26 items have `model_url`, 0 nulls.
  - [x] 3.3 Coverage verified locally in the fallback store (26/26). Supabase re-seed blocked by placeholder `.env` (URL = `your-project.supabase.co`, DNS fails); will populate the hosted `furniture_catalog.model_url` column automatically once real Supabase credentials are dropped in and the script is re-run.

- [x] 4. Normalize scale/orientation in the client 3D loader
  - [x] 4.1 Updated `client/src/components/viewer/SmartFurnitureModel.jsx`: fully center GLB on group origin (x/y/z) so the parent `<group position=[x, fh/2, z]>` in `RoomViewer3D` puts the bottom on the floor (matches `ProceduralFurniture`). Added `rotationY` prop wired to `item.model_rotation_y` for per-item facing overrides.
  - [x] 4.2 Procedural fallback path untouched: `if (!item.model_url) return fallback;` + `ModelErrorBoundary` both render the same `<ProceduralFurniture>`. `cd client && npx vite build` → ✓ built in 3.34s, 1317 modules transformed.

- [x] 5. Smoke test 3D rendering end to end (automated portions)
  - [x] Cross-checked catalog resolution via `/tmp/kenney-verify.mjs`: 26/26 fallback-store items have non-null `model_url`, all resolve to real files on disk, 0 missing.
  - [x] 3 representative files verified on disk: `loungeSofa.glb`, `bedDouble.glb`, `cabinetTelevision.glb`.
  - [x] Production build passes: `cd client && npx vite build` → `✓ built in 3.31s`, 1317 modules.
  - [x] `SmartFurnitureModel.jsx` still imports `ProceduralFurniture` and early-returns when `model_url` is null; `ModelErrorBoundary` falls back to the same procedural component.
  - [ ] **Manual browser handoff (user)**: 5.1 start services, 5.2 sign in as `test@visionstudio.dev`, add one item per category, 5.3 toggle 3D view and visually confirm each model is recognizable and sits on the floor, 5.4 clear one item's `model_url` and confirm procedural fallback renders.

- [x] 6. Update project documentation
  - [x] 6.1 Updated `AGENTS.md`: 3D Models row in Tech Stack, `kenneyMapping.js` entry in Monorepo Structure, `public/models/kenney/` entry under client/public/, revised SmartFurnitureModel + Meshy bullets in Notable Behaviors, new Agent Guidelines bullet.
  - [x] 6.2 Updated `README.md`: added Kenney line to Stack list, extended Credits / 3D Assets paragraph with pointer to the mapping module and self-check command.
