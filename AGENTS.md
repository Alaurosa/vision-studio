# AGENTS.md — Vision Studio

> **Keep this file up to date.** Every time changes are made to the codebase (new files, renamed modules, added dependencies, architectural shifts), update this document to reflect the current state.

## Project Overview

**Vision Studio** is a full-stack AI-powered spatial layout design application. Users can upload floor plans or room photos, get AI-detected room geometry and furniture, browse real IKEA/Ashley catalogs, drag-and-drop furniture in a 2D Konva editor, chat with an AI assistant for layout suggestions, and export to JSON/SVG/DXF. Built for CSE 115A Spring 2026 Capstone at UCSC by William Liu, Ethan Cao, Sriya Katreddi, and Ashley Kim.

### Current Phase

Full-stack implementation — monorepo with React/Vite client, separate Next.js marketing app, Express server, and FastAPI Python AI microservice. Supabase (hosted/public project) for auth, database, and storage. Production-hardened with code-splitting, error boundaries, rate limiting, Helmet security headers, and structured logging.

## Tech Stack

| Layer         | Technology                                    |
| ------------- | --------------------------------------------- |
| Client        | React 18.3 + Vite 5.4 + react-router-dom 6   |
| 2D Canvas     | Konva 9.3 + react-konva 18.2 + Transformer    |
| State         | Zustand 4.5                                   |
| Styling       | Tailwind CSS 3.4 (warm neutral theme)         |
| Animation     | Framer Motion 11.5                            |
| Server        | Express 4.19 (Node.js, ES modules)            |
| AI/LLM        | OpenAI gpt-5.4 (function calling) |
| Python AI     | FastAPI 0.115 + OpenAI Vision gpt-5.4 (20×20 grid + wall-snap room segmentation) + Replicate (Grounding DINO + SAM 2 for room photos; constant currently named `SAM3_MODEL`) + OpenCV fallback |
| Database      | Supabase (PostgreSQL + Auth + Storage)         |
| 3D Models     | Kenney Furniture Kit (CC0 GLBs in `client/public/models/kenney/`): starter catalog sets `modelUrl` in `furnitureCatalog.js`; API catalog via `server/services/kenneyMapping.js` at seed time. GLBs are visual-only; catalog dimensions stay source of truth. Procedural fallback when `modelUrl` is missing or load fails. Meshy v2 route exists for future batch generation, not the live editor. |
| 3D Viewer     | React Three Fiber 8.18 + @react-three/drei 9.122 + GLTFLoader |
| Marketing     | Next.js 16.2 + React 19.2 + Tailwind CSS 4 + Supabase SSR helpers |
| SEO           | react-helmet-async 3.0                        |
| Notifications | react-hot-toast 2.6                           |

## Commands

```bash
# Client (React + Vite)
cd client && npm install && npm run dev     # Dev on :5173
cd client && npm test                       # Vitest unit tests (catalog data, etc.)
cd client && npx vite build                 # Production build (verify compiles)

# Marketing app (Next.js)
cd marketing && npm install && npm run dev  # Dev on :3000
cd marketing && npm run build               # Production build
cd marketing && npm run lint                # ESLint

# Server (Express)
cd server && npm install && npm run dev     # Dev on :3001 (nodemon)
cd server && npm start                      # Production start
cd server && npm test                       # Vitest smoke tests (save/load against live Supabase)
cd server && npm run test:watch             # Watch mode

# Setup verification (checks env, DB, seeds catalog)
cd server && node scripts/setup.js

# Apply database schema (auto or manual)
node server/scripts/applySchema.js [DB_PASSWORD]

# Python AI Service
cd python && pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 5001 --reload

# Scripts
cd server && node scripts/seedFurniture.js  # Seed IKEA + Ashley data
cd server && node scripts/applySchema.js    # Apply schema.sql to Supabase
```

## Client testing — starter furniture catalog

Automated coverage lives under `client/src/**/__tests__/` (catalog data, filters, `FurnitureCatalogPanel`, `FurnitureCard`, `furniturePlacement`, `layoutStore` catalog selection, sidebar hint/clear).

**Manual QA checklist (Furniture tab → RoomCanvas placement):**

1. Open a project space in the editor (`RoomCanvas`, not project floorplan SVG mode).
2. Open the **Furniture** tab in the left workspace sidebar.
3. Search for an item (e.g. `queen`, `lamp`, or `vision`).
4. Filter by category (e.g. **Tables**) and confirm the result count updates.
5. Select a catalog card; confirm the sidebar shows **Selected: … Click the canvas to place.**
6. Click inside the room canvas; confirm furniture appears at the click (grid-snapped, centered).
7. Click again with the same item still selected; confirm repeat placement works.
8. Press **Esc**; confirm catalog selection clears (canvas hint disappears).
9. Use **Clear selection** in the sidebar; confirm the card is no longer highlighted.

`RoomCanvas` click-to-place is covered by unit tests on placement helpers and store draft `addFurniture`; full Konva canvas interaction is manual-only.

## Client testing — 3D furniture fallback

Pure logic: `client/src/utils/__tests__/furniture3d.test.js` (`resolveFurnitureModelUrl`, `resolveProceduralCategory`, dimension inches→meters).

**Manual QA checklist (RoomCanvas → 3D preview):**

1. Place starter-catalog furniture in `RoomCanvas` (Furniture tab → select → click canvas).
2. Switch the editor to **3D** view (`StudioToolbar` 2D/3D toggle).
3. Confirm placed furniture appears in the room (not an empty floor).
4. Place items from different starter categories (seating, tables, beds, storage, lighting, decor); confirm distinct Kenney GLB meshes (not identical procedural boxes).
5. Confirm footprint scale roughly matches catalog dimensions (wide sofa vs small nightstand).
6. Starter catalog items should load Kenney GLBs from `/models/kenney/*.glb` (curated `modelStatus` in `furnitureCatalog.js`).
7. Clear `modelUrl` on a placement in devtools; confirm procedural fallback still works.
8. Confirm no console errors when switching 2D ↔ 3D.

Meshy/Tripo and other external 3D APIs are **not** called from the editor viewer; procedural fallback remains required when GLB is absent or fails.

## Monorepo Structure

```
vision-studio/
├── README.md                     # Project overview + local setup guide
├── AGENTS.md                     # This file
├── .env                          # Root env file (server + Python load this; client/marketing use Vite/Next env files or shell env)
├── .env.example                  # Template for shared Supabase/OpenAI/Replicate/Meshy/server env vars
├── .gitignore
├── .prettierrc                   # Prettier config: single quotes, semi, trailing comma es5
├── supabase/
│   └── schema.sql                # Full database schema (run in Supabase SQL Editor)
│
├── client/                       # React + Vite frontend
│   ├── package.json
│   ├── vite.config.js            # @ alias → src/, proxy /api + /uploads → :3001
│   ├── tailwind.config.js        # paper/ink/sienna warm neutral palette, Fraunces + Inter fonts
│   ├── postcss.config.js
│   ├── index.html                # Google Fonts (Fraunces + Inter), entry point
│   ├── .env.local                # Client env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, VITE_* aliases, VITE_API_URL)
│   ├── public/
│   │   ├── images/                 # Static image assets (logo, portfolio photos)
│   │   └── models/                 # CC0 3D assets bundled with the client
│   │       └── kenney/             # Kenney Furniture Kit (140 low-poly GLBs, CC0 / public domain)
│   └── src/
│       ├── main.jsx              # ReactDOM.createRoot + StrictMode + BrowserRouter
│       ├── App.jsx               # Route shell with lazy-loaded pages, ErrorBoundary, HelmetProvider, Toaster
│       ├── index.css             # Tailwind directives + editorial theme + component classes + a11y focus-visible + reduced-motion
│       ├── lib/
│       │   ├── supabaseClient.js # Supabase client singleton (graceful placeholder when keys missing)
│       │   ├── api.js            # Axios instance + auth interceptor (Supabase JWT or fallback test token)
│       │   └── roomsFetchOnce.js # Dedupes concurrent GET /api/rooms (React StrictMode double-mount + multi-page)
│       ├── hooks/
│       │   ├── useAuth.js        # Auth state (signInWithPassword, signUp, signOut) + fallback test account (test@visionstudio.dev / test1234)
│       │   └── useRoomExport.js  # JSON/SVG/DXF export for current room (draft + persisted), shared by EditorWorkspaceSidebar
│       ├── store/
│       │   └── layoutStore.js    # Zustand: room, furniture, zones, detections, chat, view state, undo/redo, draft mode
│       ├── utils/
│       │   ├── constants.js      # Grid snap, clearance, category colors/labels, room templates, zone colors (16 presets + random generator)
│       │   ├── scale.js          # px↔inches conversion, snap-to-grid, rotation helpers, inchesToFeet formatter
│       │   ├── furnitureDisplay.js # formatFurnitureDimensions, provider/model status labels for catalog cards
│       │   ├── furnitureCatalogFilters.js # filterStarterFurnitureCatalog for FurnitureCatalogPanel search/category
│       │   ├── furniturePlacement.js   # createPlacedFurnitureFromCatalogItem, getFurnitureFootprintSize (catalog → placement)
│       │   ├── furniture3d.js          # 3D render helpers: modelUrl resolution, starter category→procedural map, inches→meters dimensions
│       │   ├── collision.js      # AABB detection (arbitrary rotation), overlap check, room bounds validation
│       │   ├── floorplanGeometry.js # Shared floorplan geometry normalization for project-level 2D/3D overlays (rect + polygon)
│       │   ├── projectCompat.js  # Frontend-only project compatibility layer (localStorage `vs-projects-v1`) + helper metadata for Phase 2 schema planning
│       │   ├── chatRouting.js    # Global `/chat` intent routing helper (project/space name matching → Studio routes or suggestion options)
│       │   ├── roomWallMath.js   # Wall geometry helpers (snap/clamp/move wall joints, rectangle perimeter, segment scaling, polygon vs segment detection)
│       │   ├── projectVision.js # Dedupe/normalize `globalVision` summary + tags; hub display via `formatProjectVisionSummary`
│       │   └── visionGate.js    # Client-side check that whole-property vision (`globalVision.propertyVision` + style/mood rules) is complete
│       ├── data/
│       │   └── furnitureCatalog.js # Starter catalog + `kenneyCuratedModel()` Kenney GLB metadata
│       ├── components/
│       │   ├── project/
│       │   │   └── ProjectVisionIntake.jsx   # Project Vision Assistant (`/studio/project/:id/vision`); `whole_project` chat → `globalVision`
│       │   ├── ErrorBoundary.jsx      # React class error boundary with polished fallback UI
│       │   ├── ConfirmModal.jsx       # Animated confirmation modal with Framer Motion (replaces window.confirm)
│       │   ├── auth/
│       │   │   └── LoginModal.jsx     # Inline sign-in/sign-up modal for draft→account save flow
│       │   ├── layout/
│       │   │   ├── Navbar.jsx         # Top nav (Home/New project/Studio/Chat), scroll-aware blur, mobile hamburger, skip-to-content
│       │   │   └── Footer.jsx         # Editorial 4-column footer with semantic HTML (hidden on /studio routes)
│       │   ├── canvas/
│       │   │   ├── RoomCanvas.jsx     # Konva Stage with zoom/pan, room-zone overlays, snap guides, draggable wall joints and resize-floor handles when toggled
│       │   │   ├── ProjectCanvas.jsx  # Full-floorplan SVG preview for project mode (interior/exterior overlays, Color Overlay toggle, click-to-select)
│       │   │   ├── FurnitureItem.jsx  # Draggable/rotatable Konva Group with Transformer, hover states, staggered fade-in animation (_animDelay)
│       │   │   ├── WallOutline.jsx    # Wall polygon/segment renderer
│       │   │   ├── WallJointHandles.jsx # Drag wall-joint circles when the Wall points tool is on (segment-walls only)
│       │   │   ├── WallDimensionLabels.jsx # Per-segment feet/inches labels rendered along each wall midpoint
│       │   │   ├── RoomBoundsHandles.jsx # East / south / SE corner handles that resize the floor rectangle (origin fixed) with grid-snap previews
│       │   │   └── GridOverlay.jsx    # 6" snap grid (memoized)
│       │   ├── upload/
│       │   │   ├── AnalysisWorkflow.jsx # 6-step animated floor-plan pipeline overlay (guest + authed paths)
│       │   │   └── RoomEditor.jsx     # Full-screen SVG zone editor: drag/resize/draw rooms (rectangle + polygon), edit names/dimensions/colors, native color picker, decoupled dimensions
│       │   ├── studio/
│       │   │   ├── StudioToolbar.jsx  # Save / Undo / Redo / Grid / Resize floor / Wall points / Validate / Auto-Arrange / 2D-3D / Space Assistant; keyboard shortcuts (? → portal); back link to project hub when scoped
│       │   │   ├── KeyboardShortcutsPopover.jsx  # Body portal for shortcuts (high z-index, avoids editor clipping)
│       │   │   ├── EditorWorkspaceSidebar.jsx  # IDE-style two-part sidebar: far-left activity bar (icon navigation) + collapsible content panel for Spaces/Furniture/Materials/Layers/Export (useRoomExport)
│       │   │   ├── ProjectSpaceBottomBar.jsx # Project-editor bottom bar: All Spaces + interior/exterior chips + add-interior/exterior shortcuts
│       │   │   ├── RoomSetupModal.jsx # Template + dimensions picker
│       │   │   └── ZoneBottomBar.jsx  # Bottom room switcher + room box inspector/add-remove actions
│       │   ├── catalog/
│       │   │   ├── CatalogPanel.jsx   # Legacy API-backed catalog + Recommended tab (unused in editor sidebar)
│       │   │   ├── FurnitureCatalogPanel.jsx # Starter catalog browse/search/filter in editor Furniture tab
│       │   │   └── FurnitureCard.jsx  # Reusable starter-catalog card (name, category, dimensions, preview)
│       │   ├── viewer/
│       │   │   ├── RoomViewer3D.jsx   # Room-level R3F viewer: live `selectVisibleFurniture` from layoutStore; GLB/procedural via SmartFurnitureModel (no Canvas-level Suspense)
│       │   │   ├── ProjectViewer3D.jsx # Project-level 3D fallback preview: places linked rooms in relative bounding boxes (no per-space layout)
│       │   │   ├── SmartFurnitureModel.jsx # GLB when model_url/modelUrl set; else ProceduralFurniture via furniture3d category map
│       │   │   └── ProceduralFurniture.jsx # Category-specific Three.js primitives (legacy API + starter: seating→sofa, tables, beds, storage, lamp, decor)
│       │   └── chatbot/
│       │       ├── ChatPanel.jsx      # Enhanced agentic chat sidebar — rich messages, style prompts, textarea input, auto-refresh
│       │       ├── MessageBubble.jsx  # Rich message renderer — inline markdown, action result cards, assistant avatar
│       │       └── StylePrompts.jsx   # Categorized style prompt suggestions — style chips, category tabs, animated prompts
│       └── pages/
│           ├── Home.jsx              # Editorial landing (Batako-inspired: hero, process, quote band, services, CTA, smooth staggered reveals)
│           ├── Login.jsx             # Email/password auth with Helmet SEO
│           ├── Chat.jsx              # `/chat` = Design Inspiration Assistant (local-only transcript; `draft-global-inspiration` + `room_context`, no project fields). `/studio/project/:id/chat` = Project Assistant (room + project context)
│           ├── Upload.jsx            # Floorplan intake → AI analysis → room-zone editor → finalize → `/studio/project/:id/confirm?mode=adjust` → editor
│           ├── Studio.jsx            # Dashboard (/studio), hub + confirm + vision + editor under /studio/project/..., legacy /studio/:roomId
│           ├── StudioNewWizard.jsx   # Full-page new project wizard (/studio/new)
│           └── NotFound.jsx          # Polished 404 page with animated entry
│
├── marketing/                    # Separate Next.js marketing/experiments app
│   ├── package.json              # Next 16 + React 19 + Tailwind 4
│   ├── next.config.ts
│   ├── postcss.config.mjs
│   ├── eslint.config.mjs
│   ├── tsconfig.json
│   ├── public/
│   │   └── images/               # Portfolio/landing imagery mirrored for marketing app
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx          # Renders landing page
│       │   ├── globals.css
│       │   └── todos/page.tsx    # Supabase SSR example query page
│       ├── components/landing/   # Landing-page sections
│       ├── lib/images.ts
│       ├── middleware.ts         # Next middleware entrypoint
│       └── utils/supabase/       # Supabase SSR/browser/middleware clients
│
├── server/                       # Node.js + Express backend
│   ├── package.json
│   ├── index.js                  # Entry point — imports `app` and calls .listen() with graceful SIGTERM/SIGINT shutdown
│   ├── app.js                    # Express app factory (Helmet, CORS, rate-limit, image proxy, /health, /api/status, route mounting). Exported for tests.
│   ├── vitest.config.js          # Vitest config (node env, in-band, 30s timeouts)
│   ├── __tests__/
│   │   └── saveLoad.test.js      # S2-5 save/load smoke tests — creates a real Supabase test user, exercises the full save→load→delete flow, cleans up
│   ├── .env.example              # Template for server env vars
│   ├── config/
│   │   ├── env.js                # dotenv loader (root .env; must be imported first)
│   │   └── defaults.js           # Export schema version, LLM config (gpt-5.4)
│   ├── middleware/
│   │   ├── auth.js               # requireAuth + optionalAuth (Supabase JWT + fallback test account: test@visionstudio.dev / test1234)
│   │   └── errorHandler.js       # Centralized error handling with structured logger (5xx = error, 4xx = warn)
│   ├── routes/
│   │   ├── auth.js               # GET /api/auth/me
│   │   ├── rooms.js              # CRUD + floor plan upload + calibrate + zone normalization
│   │   ├── furniture.js          # Catalog search + single item lookup + placements CRUD (with zone_id support)
│   │   ├── layout.js             # LLM auto-placement + validation (uses shared overlapResolver)
│   │   ├── chat.js               # Agentic chat route (15 tools via chatFunctions.js, multi-turn up to 5 rounds, guest/draft support)
│   │   ├── projects.js           # CRUD for `projects` + `spaces`; auto-creates compatible `rooms` rows when a space has no `room_id`; in-memory fallback when project tables are missing
│   │   ├── publicParse.js        # POST /api/public/parse-floorplan — stateless guest parse, no auth, no DB writes
│   │   ├── models.js             # Meshy API v2 image-to-3D GLB generation with in-memory cache + background polling
│   │   ├── recognition.js        # Room photo → DINO detection + SAM 2 click-segment
│   │   └── export.js             # JSON/DXF/SVG download + latest export retrieval + draft export routes (/export/{format}/draft)
│   ├── services/
│   │   ├── supabase.js           # Admin client (service role key, graceful placeholder when unconfigured)
│   │   ├── db.js                 # Shared useDb() + re-exports supabaseAdmin/fallback
│   │   ├── fallbackStore.js      # In-memory store when Supabase unavailable (27 embedded catalog items)
│   │   ├── fileStorage.js        # Shared local file storage helper (saves to uploads/)
│   │   ├── kenneyMapping.js      # Category defaults + per-item overrides → /models/kenney/*.glb (used by seedFurniture + fallbackStore)
│   │   ├── overlapResolver.js    # Shared overlap resolver (greedy spiral + linear scan) + layout validator
│   │   ├── normalizeZones.js    # Shared zone normalization (boundary-relative coordinates)
│   │   ├── chatFunctions.js      # 15 chat tool definitions + executeFunction() dispatch
│   │   ├── llmRouter.js          # OpenAI chat completions wrapper (hardcoded gpt-5.4)
│   │   ├── exportFormats.js      # Build JSON, SVG, DXF export payloads (rotation-aware, wall-format agnostic)
│   │   └── logger.js             # Structured logger with timestamps and configurable log levels
│   ├── scripts/
│   │   ├── setup.js              # Setup verification (env vars, Supabase connection, DB tables, catalog seed)
│   │   ├── seedFurniture.js      # Seed 22 IKEA + 5 Ashley catalog items (upsert on provider+provider_id)
│   │   └── applySchema.js        # Apply schema.sql via pg-meta API, psql, or manual instructions; verifies core + project tables (`projects`, `spaces`)
│   └── uploads/                  # Local file storage fallback (floor-plans/, room-photos/)
│       └── .gitkeep
│
├── python/                       # FastAPI AI microservice
│   ├── requirements.txt          # fastapi, uvicorn, opencv, numpy, Pillow, replicate, openai, pdf2image
│   ├── app.py                    # Endpoints: /health, /parse-floorplan, /detect-objects, /segment-room
│   ├── .env.example              # Template for python env vars
│   └── services/
│       ├── __init__.py
│       ├── floorplan_parser.py   # OpenAI Vision (gpt-5.4) room zoning + OpenCV wall-snap + OpenCV fallback + PDF support
│       └── object_recognition.py # Grounding DINO + SAM 2 via Replicate (constant currently named SAM3_MODEL)
│
└── docs/                         # Sprint documentation (PDFs)
```

## Environment Variables

Server and Python load the root `.env` file. The React client reads Vite env vars from `client/.env.local` or the shell when run from `client/`; the marketing app reads Next env vars from `marketing/.env.local` or the shell.

### Client (`client/.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — preferred public Supabase client vars
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — legacy aliases still accepted by client code
- `VITE_API_URL` — Backend URL (default: `http://localhost:3001`)

### Marketing (`marketing/.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — used by the Supabase SSR/browser helpers in `marketing/src/utils/supabase/`

### Server (`root/.env`)
- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_PUBLIC_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (for auth verification client)
- `SUPABASE_SERVICE_ROLE_KEY` (required for DB/admin operations)
- `OPENAI_API_KEY` (required for chat assistant)
- `REPLICATE_API_TOKEN` (optional — for AI room photo detection)
- `MESHY_API_KEY` (optional — for 3D model generation)
- `PORT` (default: 3001), `PYTHON_SERVICE_URL` (default: `http://localhost:5001`; Render: `https://vision-studio-python.onrender.com`)
- `NODE_ENV` (development/production)
- **CORS** (`server/config/corsOrigins.js`): always allows `http://localhost:5173`, `http://localhost:3000`, `http://localhost:4173`. Also merges `CLIENT_ORIGIN` (single), `CLIENT_ORIGINS` (comma-separated), and legacy `ALLOWED_ORIGINS`. Requests with **no `Origin` header** are allowed (curl/health/server-to-server). Set `ALLOW_VERCEL_PREVIEWS=true` to allow any `https://*.vercel.app` preview host (credentials stay on — no `*`). Blocked origins are logged in non-production only.
- `LOG_LEVEL` (debug/info/warn/error, default: `info`)

Current hosted DB status (expected baseline):
- Tables present: `providers`, `furniture_catalog`, `rooms`, `placements`, `layout_exports`, `chat_messages`, `projects`, `spaces`
- Catalog seed: 27 items
- Providers seed: 4
- `/api/status` checks all eight tables and reports per-table connectivity.

### Python (`root/.env`, optional `server/.env`, optional `python/.env`)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (required for OpenAI Vision room analysis)
- `REPLICATE_API_TOKEN` (required for Grounding DINO + SAM 2 room-photo recognition)
- `PORT` (default: 5001)

## State Management (Zustand)

Store in `client/src/store/layoutStore.js` (wrapped with `zustand/persist` for draft localStorage support):

| Field                   | Type              | Purpose                                     |
| ----------------------- | ----------------- | ------------------------------------------- |
| `room`                  | `object \| null`  | Current room (id, name, walls, dimensions)  |
| `furniture`             | `array`           | Placed furniture items with positions, free-angle rotation, and optional model/image URLs |
| `selectedId`            | `string \| null`  | Currently selected furniture ID              |
| `detections`            | `array`           | AI-detected objects (pending/confirmed)      |
| `zones`                 | `array`           | Confirmed sub-rooms `{id,name,color,polygon,bbox,width,depth}` |
| `activeZoneId`          | `string \| null`  | Currently focused sub-room (null = whole plan) |
| `chatHistory`           | `array`           | Chat messages for current room               |
| `projectTheme`          | `object \| null`  | Whole-property vision metadata collected during project onboarding |
| `recommendedItems`      | `array`           | AI-recommended catalog items for display     |
| `loading`               | `boolean`         | Global loading state                         |
| `viewMode`              | `string`          | '2d' or '3d'                                 |
| `gridEnabled`           | `boolean`         | Snap grid visibility                         |
| `isChatOpen`            | `boolean`         | Chat panel visibility (defaults closed in editor) |
| `undoStack`             | `array`           | Furniture state snapshots for undo           |
| `redoStack`             | `array`           | Furniture state snapshots for redo           |
| `roomWallsTool`         | `boolean`         | Studio canvas: draggable joints for segment-format `room.walls` (mutually exclusive with `roomResizeTool`) |
| `roomResizeTool`        | `boolean`         | Studio canvas: resize floor handles on E/S/SE (origin fixed; mutually exclusive with `roomWallsTool`) |
| `loadRoomFailed`        | `boolean`         | Last `loadRoom` failed (invalid id, API error, or missing draft); Studio redirects to `/studio` |
| `selectedCatalogItem`   | `object \| null`  | Starter catalog template queued for click-to-place on `RoomCanvas` (session-only, not persisted) |

Actions: `loadRoom`, `createRoom`, `createDraftRoom`, `clearDraft`, `saveDraftToAccount`, `saveProject`, `updateRoom`, `addFurniture`, `updateFurniture`, `removeFurniture`, `rotateFurniture`, `selectFurniture`, `clearSelection`, `setDetections`, `confirmDetection`, `dismissDetection`, `addChatMessage`, `clearChat`, `setProjectTheme`, `setRecommendedItems`, `clearRecommendedItems`, `setViewMode`, `toggleGrid`, `toggleRoomWallsTool`, `clearRoomWallsTool`, `toggleRoomResizeTool`, `clearRoomResizeTool`, `toggleChat`, `undo`, `redo`, `setActiveZone`, `getActiveZone`, `saveZones`, `addZone`, `updateZone`, `removeZone`, `getVisibleFurniture`, `findOpenSlot`, `validate`.

Internal helpers: `normalizeZone`, `normalizeZonesArray`, `getZoneBounds`, `furnitureBelongsToZone`, `normalizeDetectedObjects`, `normalizeZoneObjects` — handle various zone/detection data shapes from the server.

`saveProject` is an explicit-save action: it flushes pending debounced edits, then `PUT /api/rooms/:id` + `PUT /api/furniture/placements/:id` for every placement. Drafts delegate to `saveDraftToAccount` (caller is responsible for auth).

## API Routes

### Server Built-in Endpoints

| Method | Route | Description |
| --- | --- | --- |
| GET | `/health` | Server health check (status, version, uptime, environment) |
| GET | `/api/status` | Database connectivity check — short-circuits to `unconfigured` when env vars are missing/placeholder; otherwise probes all 8 tables in parallel with a 3.5s timeout each |
| GET | `/api/proxy-image?url=` | CORS image proxy for WebGL textures (whitelisted domains include IKEA, Ashley, Storyblok, and Living Spaces image hosts) |

### Auth Routes

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/auth/me` | Current user info (requires auth) |

### Room Routes

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/rooms` | Create room |
| GET | `/api/rooms` | List user rooms (with placements) |
| GET | `/api/rooms/:id` | Get room + placements |
| PUT | `/api/rooms/:id` | Update room (name, dimensions, walls, zones, scale) |
| DELETE | `/api/rooms/:id` | Delete room and associated placements |
| POST | `/api/rooms/:id/upload-floorplan` | Upload floor plan → Python AI parse → zone extraction + dimension detection |
| POST | `/api/rooms/:id/calibrate` | Two-point scale calibration (p1, p2, real_world_inches) |

### Project Routes (Phase 2 additive alignment)

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/projects` | List user projects with nested spaces |
| POST | `/api/projects` | Create project metadata (`property_type`, `scope`, `global_vision`, `status`) |
| GET | `/api/projects/:id` | Get single project with spaces |
| PUT | `/api/projects/:id` | Update project metadata |
| DELETE | `/api/projects/:id` | Delete project (space records cascade) |
| POST | `/api/projects/:projectId/spaces` | Create space and auto-link/create room-compatible editor record |
| PUT | `/api/projects/:projectId/spaces/:spaceId` | Update space metadata |
| DELETE | `/api/projects/:projectId/spaces/:spaceId` | Delete space metadata |

### Furniture Routes

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/furniture/catalog` | Search catalog (?category, ?provider, ?q, ?limit, ?offset) |
| GET | `/api/furniture/catalog/:id` | Get single catalog item by ID |
| GET | `/api/furniture/categories` | List distinct categories |
| POST | `/api/furniture/placements` | Add furniture to room (supports zone_id) |
| PUT | `/api/furniture/placements/:id` | Update placement position/rotation/color/zone |
| DELETE | `/api/furniture/placements/:id` | Remove placement (ownership verified) |

### Layout Routes

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/layout/auto-place` | LLM auto-place all furniture optimally (uses overlapResolver) |
| POST | `/api/layout/validate` | Validate current layout for overlaps and bounds |

### Chat Routes

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/chat/message` | Agentic chat (LLM + 15 function tools, multi-turn up to 5 rounds, guest/draft support via optionalAuth) |

### Public Routes (no auth)

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/public/parse-floorplan` | Stateless guest floorplan parse (no auth, no DB writes) |

### 3D Model Routes

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/models/generate` | Submit image-to-3D task via Meshy v2 (returns immediately, polls in background) |
| GET | `/api/models/status/:task_id` | Poll Meshy task progress |
| GET | `/api/models/lookup?image_url=` | Cache lookup by image URL |

### Recognition Routes

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/recognition/room-photo/:room_id` | Photo → Grounding DINO detection |
| POST | `/api/recognition/click-segment` | Click → SAM 2 segmentation |

### Export Routes

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/export/json/draft` | Download JSON layout for a local draft room |
| POST | `/api/export/dxf/draft` | Download DXF layout for a local draft room |
| POST | `/api/export/svg/draft` | Download SVG layout for a local draft room |
| POST | `/api/export/json/:room_id` | Download JSON layout |
| POST | `/api/export/dxf/:room_id` | Download DXF layout |
| POST | `/api/export/svg/:room_id` | Download SVG layout |
| GET | `/api/export/latest/:room_id` | Get latest exported JSON for a room |

### Python AI Endpoints (port 5001)

| Method | Route | Description |
| --- | --- | --- |
| GET | `/health` | Service health check |
| POST | `/parse-floorplan` | Floor plan image/PDF → room detection + wall segmentation |
| POST | `/detect-objects` | Image/URL → Grounding DINO object detection |
| POST | `/segment-room` | Image URL + bboxes → SAM 2 segmentation masks |

## Database Tables (Supabase)

- **`providers`** — IKEA, Ashley, Wayfair, Custom (seeded via schema.sql)
- **`furniture_catalog`** — 27 seeded items (22 IKEA + 5 Ashley) with dimensions, prices, provider links, model_url; public read via RLS; unique index on `(provider, provider_id)` for upsert
- **`rooms`** — User rooms with walls (jsonb), dimensions, floor plan/photo URLs, detected_objects (jsonb), zones (jsonb array of sub-rooms); RLS: own rooms only
- **`projects`** — User projects/floorplans with `property_type`, `scope`, `global_vision`, `status`; RLS: own projects only
- **`spaces`** — Project-level interior/exterior space structure linked to existing `rooms` via nullable `room_id`; includes `category`, `space_vision`, `placeholder_mode`; RLS: via owning project
- **`placements`** — Furniture placed in rooms with position, rotation, color, optional zone_id for sub-room assignment; RLS: via room ownership join
- **`layout_exports`** — Archived JSON exports with schema_version; RLS: via room ownership join
- **`chat_messages`** — Chat history per room with role, content, tool_calls (jsonb), model_used; RLS: via room ownership join

All tables use Row Level Security — users can only access their own data. The `furniture_catalog` table has a public read policy.

## Styling Conventions

- Warm neutral editorial theme: `bg-paper-50` (#faf7f1), `text-ink-900` (#100f0d)
- Sienna accent: `sienna-500: #9c6a3f`
- Shared `surface-*` palette is harmonized to the same warm editorial family as Home/Hero so Studio/Chat/Auth pages match the brand tone
- Fraunces serif display (`font-display`), Inter sans-serif body (`font-sans`) from Google Fonts
- Cards: `.panel` → `bg-paper-100/70 border border-ink-900/10 backdrop-blur rounded-lg`
- Buttons: `.btn-ink` (solid dark), `.btn-ghost` (outline), `.btn-sienna` (accent)
- Inputs: `.input-field` → transparent bg, bottom border, focus transition
- Typography: `.eyebrow` (uppercase 11px tracking), `.display-xl/lg/md` (Fraunces responsive clamp sizes)
- All buttons include `focus-visible:ring-2` for keyboard accessibility
- `prefers-reduced-motion` is respected globally via CSS and Framer Motion
- Tailwind utility classes only — no CSS modules
- Custom scrollbar styling (thin, rounded, semi-transparent)
- Noise texture overlay available via `.noise::before` pseudo-element
- Prettier config: single quotes, semicolons, trailing comma es5, 2-space indentation (`tabWidth: 2`), 100 print width

## Notable Behaviors

- Furniture can be rotated freely in the 2D editor via the Konva transformer handle, 15° toolbar nudges, or the in-canvas rotation slider.
- **3D furniture rendering** (`RoomViewer3D` + `SmartFurnitureModel` + `client/src/utils/furniture3d.js`): **`RoomViewer3D`** (room-scoped editor with `RoomCanvas`) subscribes to `layoutStore` via `selectVisibleFurniture` and renders the same placements as 2D. **`ProjectViewer3D`** is floorplan-only (zones/spaces, no furniture). If a placement has `model_url` or `modelUrl`, load the GLB (uniform-scaled to catalog footprint/dimensions, `model_rotation_y` optional); on load error or missing URL, fall back to `ProceduralFurniture` (per-item Suspense/error boundary—do not wrap the whole `Canvas` in Suspense or GLB loading unmounts the scene). **Starter catalog** (`client/src/data/furnitureCatalog.js`) ships curated Kenney `modelUrl` values (`modelStatus: curated`, `modelSourceType: kenney`, CC0 attribution fields); GLBs are visual proxies only—**catalog inch dimensions remain the layout source of truth**. This path does **not** call Meshy/Tripo from the editor.
- The legacy Meshy v2 route (`/api/models/*`) and server `kenneyMapping.js` remain for seeded API catalog items but are not required for starter-catalog editor placements.
- Floorplan upload uses a 3-stage pipeline: (1) 20×20 grid overlay drawn on image, (2) GPT-5.4 identifies rooms using grid coordinates — returns rectangular bboxes for simple rooms and polygon vertices for L-shaped/irregular rooms (only real habitable rooms — no hallways, stairs, or entries), (3) OpenCV wall-snap aligns each bbox edge to the nearest architectural wall. Results are normalized into editable `zones` stored in room-local coordinates.
- The RoomEditor (`upload/RoomEditor.jsx`) supports both rectangular and polygon room shapes. Users can draw rectangles (click-drag) or polygons (click vertices, close by clicking first vertex or "Close Shape" button). AI-detected polygons are rendered as SVG polygons with vertex handles. Room dimensions are decoupled from the visual shape.
- The pre-editor adjust/confirm step is the geometry source of truth for the frontend project overlay: confirmed spaces persist normalized geometry on the localStorage-backed compatibility object (`project.floorplan.zones[]` and `project.spaces[].geometry` with `type`, `bbox`, optional polygon `points`, `source`) before entering the editor. The Supabase `projects`/`spaces` schema currently stores project/space metadata and room links; durable geometric room data still lives on `rooms.zones`.
- The studio canvas (`RoomCanvas.jsx`) renders polygon zones using Konva `Line` with the actual polygon points, not just bounding boxes. This allows non-rectangular rooms to display correctly in the editor.
- The studio canvas supports room-focused editing: selecting a zone zooms the center pane to that room, constrains furniture placement to the selected room, and exposes draggable/resizable color-coded room boxes plus a bottom room inspector.
- **Wall + floor editing in `RoomCanvas`** (gated by toolbar toggles in 2D mode): `Wall points` reveals draggable Konva joint handles for segment-format `room.walls` (snap to 6" grid, clamped to floor); `Resize floor` reveals orange E/S/SE handles that resize the floor rectangle (origin fixed, segment walls scale to the new box for preview). Toggles are mutually exclusive; `Esc` clears both. Wall edits commit via `updateRoom({ walls })`; floor edits commit via `updateRoom({ width, depth })`. `WallDimensionLabels` shows feet/inches along each segment.
- **Explicit save**: `StudioToolbar` always exposes a `Save Project` button (`saveProject()` flushes pending debounced edits and persists every placement). Drafts route through `LoginModal` first, then run `saveDraftToAccount()`.
- Client-side route changes reset the window scroll position to the top so navigation between Home, Upload, and Studio never preserves mid-page scroll offsets.
- The homepage uses eased, staggered Framer Motion reveals with reduced-motion fallbacks so sections enter smoothly without abrupt jumps.
- Toast notifications (`react-hot-toast`) are used throughout for all user-facing feedback (export success, validation results, add-to-room, etc.). Toasts use dark pill style matching the editorial theme.
- All pages have proper `<title>` and `<meta description>` via `react-helmet-async` for SEO.
- A 404 page is shown for unknown routes instead of a silent redirect.
- All destructive actions (room delete) use a styled `ConfirmModal` instead of `window.confirm`.
- The server uses `helmet` for security headers, `express-rate-limit` for rate limiting (120 req/min general, 20/15min for auth), and graceful shutdown on SIGTERM/SIGINT with 10s forced exit timeout.
- Structured logging (`services/logger.js`) replaces raw `console.log/error` in server code. Request logging warns on slow (>2s) or error (≥400) responses.
- The build uses manual Rollup chunks to split React, Konva, Three.js, Framer Motion, and Supabase into separate vendor bundles for optimal caching.
- A skip-to-content link is rendered before the header for keyboard/screen-reader accessibility.
- The server includes an image proxy endpoint (`/api/proxy-image`) that serves external product images with proper CORS headers for WebGL textures, restricted to whitelisted domains (IKEA, Ashley, Storyblok, Living Spaces image hosts).
- Both Supabase clients (server admin + client anon) gracefully handle missing/placeholder credentials — they create a client pointing at a placeholder URL so the app boots without crashing, and operations fail at request time with clear warnings.
- The `zone_id`, `image_url`, and `model_url` columns on placements (and `zones` on rooms) use additive migrations (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) for backward compatibility. `placementPersistence.js` retries inserts/updates without optional columns when PostgREST reports a missing column in the schema cache (including when values are `null`).
- `projects`/`spaces` endpoints use a narrow fallback guard: when Supabase returns relation-missing errors for those two tables, routes fall back to the in-memory compatibility store instead of failing authenticated flows.
- **`loadRoom` recovery**: Failed server fetch or missing draft after rehydration sets `loadRoomFailed`; `Studio.jsx` toasts and replaces the route to `/studio` so the editor never spins forever. Switching to another server room clears stale `room`/placements until the new fetch completes.
- **Guest / Draft Mode**: Upload and Studio pages are accessible without authentication. Guests create local "draft" rooms stored in localStorage via Zustand `persist`. The `StudioToolbar` shows a "Save to account" button that opens a `LoginModal` inline. On save, `saveDraftToAccount()` pushes the room, zones, and placements to the server. The guest upload path uses `/api/public/parse-floorplan` to avoid auth. 401 responses from the API are silently handled (no redirect).
- When Supabase **public** URL/key are missing in the client (`client` env / `VITE_` + `NEXT_PUBLIC_` aliases), the app skips Supabase Auth network calls and uses the guest/test-token path only — avoiding failed session requests to placeholder hosts. `fetchRoomsListOnce()` dedupes concurrent `GET /api/rooms` during React StrictMode double-mount.
- Project space rows from the API normalize `type` to `interior` \| `exterior` (string casing + optional `placeholder_mode` fallback) so exterior spaces stay in the Exterior section after refresh.
- The chat endpoint runs a multi-turn tool execution loop (up to 5 rounds). After each round of tool calls, it re-fetches placements from the DB before executing the next tool, ensuring tools always operate on current state.
- Studio now presents a **project-first dashboard** at `/studio`, with localStorage-backed compatibility objects that group existing backend room records into floorplan projects. The dashboard safely merges `GET /api/projects` with local `vs-projects-v1`: **API projects remain authoritative for spaces/room links**, matching IDs keep a **local `globalVision` overlay**, and **local-only projects still render** so prior drafts remain visible during migration.
- Project compatibility shaping (`toDashboardProjects`) no longer drops spaces whose `roomId` no longer exists in the current room list. These spaces remain visible and are flagged with `missingLinkedRoom` so interior/exterior structure is preserved while users relink or recreate editable rooms.
- **Guided new-project flow** (only when user goes through `/studio/new` or upload intake): **`/studio/new`** → **`/studio/project/:id/confirm?mode=adjust`** (Adjust Spaces / `RoomEditor`) → **`/studio/project/:id/editor/:firstEditableSpace`**. Project hub and **`/vision`** remain available but no longer gate floorplan setup. **`/confirm?phase=spaces`** redirects to **`?mode=adjust`** (legacy Floorplan Intake removed). Opening an **existing** project from `/studio` goes **directly to the project hub** — no automatic redirect to vision or confirm once the user can navigate freely. **`/studio/project/:id/chat`** is the full-page **Project Assistant** (project-wide Q&amp;A); **`/vision`** is the **Project Vision Assistant** structured intake. **Space Assistant** = editor `ChatPanel`. Legacy `/studio/project/:id/:spaceId` → `.../editor/:spaceId` unless `legacySpaceId` is `confirm`, `vision`, `editor`, or `chat`. `/upload` → wizard.
- **Hub** (`/studio/project/:id`): primary **Open Editor**; **Open Project Vision Assistant** (`/vision`); **Review Spaces** (`/confirm?from=hub`). Optional project Q&amp;A at `/chat`. Hub vision summary uses `formatProjectVisionSummary` (deduped text, tags shown once). **Continue guided setup** appears only while vision or confirmation is incomplete.
- **Project editor scope**: `/studio/project/:id/editor` now opens **full-floorplan project mode** by default (not auto-routed into one room). `/studio/project/:id/editor/:spaceId` keeps the same project editor shell and sets the selected space context. In project mode, 2D/3D have project-wide fallback previews (`ProjectCanvas` / `ProjectViewer3D`) and the bottom bar lists **All Spaces + interior/exterior spaces** from project metadata; spaces without linked rooms remain selectable and show a placeholder notice instead of hard-failing.
- **Project editor title + 3D fallback**: In project mode, toolbar metadata resolves the project name from current loaded project data (with query fallback) instead of a static label. `ProjectViewer3D` no longer lays out spaces in a generic strip; it uses linked room-zone bounding boxes for relative placement and shows a clean "3D preview needs confirmed floorplan geometry" fallback when usable geometry is missing.
- **Color overlay toggle**: Both pre-editor (`RoomEditor`) and project editor (`ProjectCanvas`) include a visual-only `Color Overlay` toggle to switch between filled overlays and outline-only overlays over the floorplan image; geometry data is unchanged.
- **Canonical review path**: Project hub **Review Spaces** now routes to `/studio/project/:id/confirm?mode=adjust`, which opens the `RoomEditor`-based adjust workflow for move/resize/rename/type/overlay edits and persists updates back into the local project compatibility overlay (`project.floorplan.zones` + `project.spaces[].geometry`) while room-level zones remain in `rooms.zones`.
- **Editor entry hardening**: Hub **Open Editor** now chooses the first editable linked space (interior-first) and navigates to `/studio/project/:id/editor/:spaceId`. If no space has a valid linked room, the hub shows an inline guidance state (Review Spaces / Add Interior / Add Exterior) instead of bouncing with a toast.
- **Project vision** in **`ProjectVisionIntake.jsx`**: chatbot-first intake at `/vision` (quick mood chips + optional chat input, project spaces as context). Persists structured `globalVision` via `prepareGlobalVisionForSave` / `normalizeGlobalVision` in `projectVision.js` (overwrite fields, never append duplicate sentences). **`upsertProject`** normalizes vision before localStorage write. Hub display uses `formatProjectVisionSummary` as a read-only safety net. **Confirmation** sets `confirmationCompletedAt` and opens the editor when appropriate. AI unavailable → toast + deterministic fallback in-thread.
- Editor route also resolves legacy upload-derived ids like `space-zone-*` via `zoneId`, then rewrites to canonical `/editor/:spaceId` when a match exists.
- **`App.jsx`** hides **Navbar**/**Footer** on **editor**, **vision**, and **`/studio/project/:id/chat`**.
- The project detail page (`/studio/project/:projectId`) acts as a floorplan hub with Interior/Exterior sections, empty-state add actions, and type pickers for creating interior/exterior spaces while still creating backend-compatible room records under the hood.
- Project cards on `/studio` include status, space counts, last-updated metadata, and dual actions (`Open project`, `Continue editing`) with a CSS-only architectural preview placeholder.
- **New Project** uses the full-page wizard at `/studio/new` (modal removed). Upload-intake projects navigate into embedded `Upload` on the wizard after the shell project is created; primary nav no longer promotes `/upload` as a top-level item.

## Chatbot Function Calling

The chat endpoint supports 15 layout manipulation functions via LLM tool use:
- `move_furniture` — Move item to (x, y) position
- `rotate_furniture` — Rotate to 0/90/180/270°
- `suggest_furniture` — Query catalog by category, size, provider
- `add_furniture` — Add catalog item to room at computed position
- `remove_furniture` — Remove item from room
- `validate_layout` — Check overlaps and bounds
- `arrange_room` — AI auto-arrange all furniture (uses nested LLM call)
- `swap_furniture` — Replace one item with another from catalog
- `furnish_room` — Autonomously select + place + arrange furniture for a room type
- `set_style_preference` — Record user style/mood/palette preferences for context-aware suggestions
- `clear_room` — Remove all furniture at once
- `estimate_budget` — Calculate total cost of current furniture
- `get_room_summary` — Detailed room state with dimensions, coverage, and validation
- `design_advice` — AI-powered professional design advice for the current layout
- `compare_items` — Compare two catalog items side by side (dimensions, price, fit)

## Agent Guidelines

- **Client code** goes in `client/src/` — React components, hooks, utils
- **Marketing code** goes in `marketing/src/` — separate Next.js landing/experiments app
- **Server code** goes in `server/` — Express routes, services, middleware
- **Python AI code** goes in `python/` — FastAPI endpoints, CV/ML services
- Use `@/` import alias for client code (resolves to `client/src/`)
- All API calls from client go through `client/src/lib/api.js` (auto-JWT)
- Environment variables come from `.env` files — never hardcode secrets
- Server gracefully handles missing API keys (returns stubs/warnings)
- Run `cd client && npx vite build` to verify client compiles
- The LLM model is hardcoded to `gpt-5.4` across all services (server llmRouter, Python floorplan parser)
- The `server/routes/models.js` route handles Meshy v2 image-to-3D generation with in-memory caching and background polling
- When adding new catalog items, wire their Kenney GLB in `server/services/kenneyMapping.js` (add a `PROVIDER_OVERRIDES` entry if a closer match than the `CATEGORY_DEFAULTS` exists). Run `node server/services/kenneyMapping.js` to verify every mapping resolves to a real file under `client/public/models/kenney/`.
- The `server/scripts/applySchema.js` script can auto-apply the DB schema via pg-meta or psql — useful for CI/setup
- `marketing/` is a separate Next.js app used for landing/experiments (runs with `cd marketing && npm run dev`)
- Marketing Supabase SSR helpers live in:
  - `marketing/src/utils/supabase/server.ts`
  - `marketing/src/utils/supabase/client.ts`
  - `marketing/src/utils/supabase/middleware.ts`
  - `marketing/src/middleware.ts`
  - Example query page: `marketing/src/app/todos/page.tsx`
- **Update this AGENTS.md file whenever changes are made**
