# AGENTS.md — Vision Studio

> **Keep this file up to date.** Every time changes are made to the codebase (new files, renamed modules, added dependencies, architectural shifts), update this document to reflect the current state.

## Project Overview

**Vision Studio** is a full-stack AI-powered spatial layout design application. Users can upload floor plans or room photos, get AI-detected room geometry and furniture, browse real IKEA/Ashley catalogs, drag-and-drop furniture in a 2D Konva editor, chat with an AI assistant for layout suggestions, and export to JSON/SVG/DXF. Built for CSE 115A Spring 2026 Capstone at UCSC by William Liu, Ethan Cao, Sriya Katreddi, and Ashley Kim.

### Current Phase

Full-stack implementation — monorepo with React client, Express server, and FastAPI Python AI microservice. Supabase for auth, database, and storage. Production-hardened with code-splitting, error boundaries, rate limiting, Helmet security headers, and structured logging.

## Tech Stack

| Layer         | Technology                                    |
| ------------- | --------------------------------------------- |
| Client        | React 18.3 + Vite 5.3 + react-router-dom 6   |
| 2D Canvas     | Konva 9.3 + react-konva 18.2 + Transformer    |
| State         | Zustand 4.5                                   |
| Styling       | Tailwind CSS 3.4 (warm neutral theme)         |
| Server        | Express 4.19 (Node.js, ES modules)            |
| AI/LLM        | OpenAI Codex 5.3 (function calling)               |
| Python AI     | FastAPI + GPT-5.4 Vision (20×20 grid + wall-snap room segmentation) + Replicate (Grounding DINO + SAM 3) + OpenCV fallback |
| Database      | Supabase (PostgreSQL + Auth + Storage)         |
| 3D Models     | Meshy AI v2 (image-to-3D GLB generation) + catalog GLB URLs |
| 3D Viewer     | React Three Fiber + @react-three/drei + GLTFLoader |

## Commands

```bash
# Client (React + Vite)
cd client && npm install && npm run dev     # Dev on :5173

# Server (Express)
cd server && npm install && npm run dev     # Dev on :3001

# Setup verification (checks env, DB, seeds catalog)
cd server && node scripts/setup.js

# Python AI Service
cd python && pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 5001 --reload

# Scripts
cd server && node scripts/seedFurniture.js  # Seed IKEA + Ashley data
```

## Monorepo Structure

```
vision-studio/
├── README.md                     # Project overview + local setup guide
├── AGENTS.md                     # This file
├── CLAUDE.md                     # Master implementation guide
├── .gitignore
├── supabase/
│   └── schema.sql                # Full database schema (run in Supabase SQL Editor)
│
├── client/                       # React + Vite frontend
│   ├── package.json
│   ├── vite.config.js            # @ alias → src/, proxy /api → :3001
│   ├── tailwind.config.js        # brand (blue), surface (warm neutral) colors
│   ├── postcss.config.js
│   ├── index.html                # Google Fonts Inter, entry point
│   ├── .env.local.example        # Template for client env vars
│   └── src/
│       ├── main.jsx              # ReactDOM.createRoot + StrictMode
│       ├── App.jsx               # Route shell with lazy-loaded pages, ErrorBoundary, HelmetProvider, Toaster
│       ├── index.css             # Tailwind directives + editorial theme + a11y focus-visible + reduced-motion
│       ├── lib/
│       │   ├── supabaseClient.js # Supabase client singleton
│       │   └── api.js            # Axios + JWT interceptor + cached auth token + 401 auto-signout
│       ├── hooks/
│       │   └── useAuth.js        # Auth state, signInWithOtp, signOut
│       ├── store/
│       │   └── layoutStore.js    # Zustand: room, furniture, detections, chat, view state
│       ├── utils/
│       │   ├── constants.js      # Grid snap, clearance, category colors
│       │   ├── scale.js          # px↔inches conversion, snap-to-grid, inchesToFeet formatter
│       │   └── collision.js      # AABB detection, overlap check, room bounds
│       ├── components/
│       │   ├── ErrorBoundary.jsx      # React error boundary with polished fallback UI
│       │   ├── ConfirmModal.jsx       # Animated confirmation modal (replaces window.confirm)
│       │   ├── auth/
│       │   │   ├── ProtectedRoute.jsx # Auth gate with branded spinner
│       │   │   └── LoginModal.jsx    # Inline sign-in/sign-up modal for draft→account save flow
│       │   ├── layout/
│       │   │   ├── Navbar.jsx        # Top nav (Home/Upload/Studio), scroll-aware, mobile hamburger, skip-to-content
│       │   │   └── Footer.jsx        # Editorial footer with semantic HTML (hidden in /studio)
│       │   ├── canvas/
│       │   │   ├── RoomCanvas.jsx    # Konva Stage with zoom/pan, room-zone overlays, and free-angle rotation controls
│       │   │   ├── FurnitureItem.jsx # Draggable/rotatable Konva Group with Transformer-based free rotation
│       │   │   ├── WallOutline.jsx   # Wall polygon/segment renderer
│       │   │   └── GridOverlay.jsx   # 6" snap grid (memoized)
│       │   ├── upload/
│       │   │   └── AnalysisWorkflow.jsx # 6-step animated floor-plan pipeline overlay (guest + authed paths)
│       │   ├── studio/
│       │   │   ├── StudioToolbar.jsx # Undo/Redo/Grid/Validate/Auto-Arrange/2D/3D/Export/Chat/Shortcuts
│       │   │   ├── RoomSetupModal.jsx # Template + dimensions picker
│       │   │   └── ZoneBottomBar.jsx # Bottom room switcher + room box inspector/add-remove actions
│       │   ├── catalog/
│       │   │   └── CatalogPanel.jsx  # Search + category chips + product images + Recommended tab
│       │   ├── viewer/
│       │   │   ├── RoomViewer3D.jsx  # React Three Fiber — floor/walls/GLB furniture + OrbitControls + Suspense loading
│       │   │   └── SmartFurnitureModel.jsx # Loads model_url GLBs or backfills via Meshy from product images
│       │   ├── chatbot/
│       │   │   ├── ChatPanel.jsx     # Enhanced agentic chat sidebar — rich messages, style prompts, textarea input, auto-refresh
│       │   │   ├── MessageBubble.jsx  # Rich message renderer — inline markdown, action result cards, assistant avatar
│       │   │   └── StylePrompts.jsx   # Categorized style prompt suggestions — style chips, category tabs, animated prompts
│       └── pages/
│           ├── Home.jsx              # Editorial landing (Batako-inspired: hero, process, quote band, services, CTA, smooth staggered reveals)
│           ├── Login.jsx             # Email/password auth with Helmet SEO
│           ├── Chat.jsx              # Full-screen AI design assistant — room selector, style preferences, rich chat
│           ├── Upload.jsx            # Drop-zone → AnalysisWorkflow → /studio/:roomId
│           ├── Studio.jsx            # Room dashboard (with styled delete confirm) + responsive 3-panel editor
│           └── NotFound.jsx          # Polished 404 page with animated entry
│
├── server/                       # Node.js + Express backend
│   ├── package.json
│   ├── index.js                  # Express entry: Helmet, CORS, rate-limit, structured logging, graceful shutdown
│   ├── .env.example              # Template for server env vars
│   ├── config/
│   │   ├── env.js                # dotenv loader (must be imported first)
│   │   └── defaults.js           # Hardcoded defaults, furniture bounds, colors
│   ├── middleware/
│   │   ├── auth.js               # Supabase JWT verification
│   │   └── errorHandler.js       # Centralized error handling with structured logger
│   ├── routes/
│   │   ├── auth.js               # GET /api/auth/me
│   │   ├── rooms.js              # CRUD + floor plan upload + calibrate
│   │   ├── furniture.js          # Catalog search + placements CRUD
│   │   ├── layout.js             # LLM auto-placement + validation (uses shared overlapResolver)
│   │   ├── chat.js               # Agentic chat route (9 tools via chatFunctions.js)
│   │   ├── publicParse.js        # POST /api/public/parse-floorplan — stateless guest parse, no auth
│   │   ├── models.js             # Meshy API v2 image-to-3D GLB generation
│   │   ├── recognition.js        # Room photo → DINO detection + SAM click-segment
│   │   └── export.js             # JSON/DXF/SVG download endpoints
│   ├── services/
│   │   ├── supabase.js           # Admin client (service role key)
│   │   ├── db.js                 # Shared useDb() + re-exports supabaseAdmin/fallback
│   │   ├── fallbackStore.js      # In-memory store when Supabase unavailable
│   │   ├── fileStorage.js        # Shared local file storage helper (saves to uploads/)
│   │   ├── overlapResolver.js    # Shared overlap resolver + layout validator
│   │   ├── chatFunctions.js      # Chat tool definitions (10 tools) + executeFunction()
│   │   ├── llmRouter.js          # OpenAI Codex 5.3 chat completions + function calling
│   │   ├── exportFormats.js      # Build JSON, SVG, DXF export payloads (rotation-aware)
│   │   └── logger.js             # Structured logger with timestamps and log levels
│   └── scripts/
│       ├── setup.js              # Setup verification (env, DB, seed)
│       └── seedFurniture.js      # Seed 22 IKEA + 5 Ashley catalog items
│
├── python/                       # FastAPI AI microservice
│   ├── requirements.txt
│   ├── app.py                    # Endpoints: /parse-floorplan, /detect-objects, /segment-room, /estimate-scale
│   ├── .env.example              # Template for python env vars
│   └── services/
│       ├── __init__.py
│       ├── floorplan_parser.py   # OpenAI Vision room zoning + Replicate/OpenCV fallbacks + PDF support
│       ├── object_recognition.py # Grounding DINO + SAM 3 via Replicate
│       └── scale_estimator.py    # Manual calibration stub
│
└── app/                          # Legacy Next.js skeleton (to be removed)
```

## Environment Variables

### Client (`client/.env.local`)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key
- `VITE_API_URL` — Backend URL (default: `http://localhost:3001`)

### Server (`server/.env`)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (required for chat assistant)
- `REPLICATE_API_TOKEN` (optional — for AI room photo detection)
- `MESHY_API_KEY` (optional — for offline 3D model generation)
- `PORT` (default: 3001), `PYTHON_SERVICE_URL` (default: `http://localhost:5001`)
- `ALLOWED_ORIGINS` (comma-separated, default: `http://localhost:5173,http://localhost:4173`)
- `LOG_LEVEL` (debug/info/warn/error, default: `info`)

### Python (`python/.env`)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (required for Codex 5.3 Vision room analysis)
- `REPLICATE_API_TOKEN`
- `PORT` (default: 5001)

## State Management (Zustand)

Store in `client/src/store/layoutStore.js` (wrapped with `zustand/persist` for draft localStorage support):

| Field          | Type              | Purpose                                     |
| -------------- | ----------------- | ------------------------------------------- |
| `room`         | `object \| null`  | Current room (id, name, walls, dimensions)  |
| `furniture`    | `array`           | Placed furniture items with positions, free-angle rotation, and optional model/image URLs |
| `selectedId`   | `string \| null`  | Currently selected furniture ID              |
| `detections`   | `array`           | AI-detected objects (pending/confirmed)      |
| `chatHistory`  | `array`           | Chat messages for current room               |
| `loading`      | `boolean`         | Global loading state                         |
| `viewMode`     | `string`          | '2d' or '3d'                                 |
| `gridEnabled`  | `boolean`         | Snap grid visibility                         |
| `isChatOpen`   | `boolean`         | Chat panel visibility                        |
| `undoStack`    | `array`           | Furniture state snapshots for undo           |
| `redoStack`    | `array`           | Furniture state snapshots for redo           |
| `zones`        | `array`           | Confirmed sub-rooms `{id,name,color,polygon,bbox,width,depth}` |
| `activeZoneId` | `string \| null`  | Currently focused sub-room (null = whole plan) |

Actions: `loadRoom`, `createRoom`, `createDraftRoom`, `clearDraft`, `saveDraftToAccount`, `saveRoomGeometry`, `updateRoom`, `addFurniture`, `updateFurniture`, `removeFurniture`, `rotateFurniture`, `selectFurniture`, `clearSelection`, `setDetections`, `confirmDetection`, `dismissDetection`, `addChatMessage`, `clearChat`, `setRecommendedItems`, `clearRecommendedItems`, `setViewMode`, `toggleGrid`, `toggleChat`, `undo`, `redo`, `setActiveZone`, `saveZones`, `addZone`, `updateZone`, `removeZone`, `getVisibleFurniture`.

## API Routes

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/auth/me` | Current user info |
| POST | `/api/rooms` | Create room |
| GET | `/api/rooms` | List user rooms |
| GET | `/api/rooms/:id` | Get room + placements |
| PUT | `/api/rooms/:id` | Update room |
| POST | `/api/rooms/:id/upload-floorplan` | Upload floor plan → GPT/OpenCV room segmentation + zone extraction |
| POST | `/api/rooms/:id/calibrate` | Two-point scale calibration |
| GET | `/api/furniture/catalog` | Search catalog (?category, ?provider, ?q) |
| GET | `/api/furniture/categories` | List categories |
| POST | `/api/furniture/placements` | Add furniture to room |
| PUT | `/api/furniture/placements/:id` | Update placement position/rotation |
| DELETE | `/api/furniture/placements/:id` | Remove placement |
| POST | `/api/layout/auto-place` | LLM auto-place all furniture optimally |
| POST | `/api/chat/message` | Agentic chat (LLM + 10 function tools incl. style preferences) |
| POST | `/api/public/parse-floorplan` | Stateless guest floorplan parse (no auth, no DB writes) |
| POST | `/api/models/generate` | Submit image-to-3D task via Meshy |
| GET | `/api/models/status/:task_id` | Poll Meshy task progress |
| GET | `/api/models/lookup` | Cache lookup by image URL |
| POST | `/api/recognition/room-photo/:room_id` | Photo → DINO detection |
| POST | `/api/recognition/click-segment` | Click → SAM segmentation |
| POST | `/api/export/json/:room_id` | Download JSON |
| POST | `/api/export/dxf/:room_id` | Download DXF |
| POST | `/api/export/svg/:room_id` | Download SVG |

## Database Tables (Supabase)

- **`providers`** — IKEA, Ashley, Wayfair, Custom
- **`furniture_catalog`** — 27 seeded items with dimensions, prices, provider links
- **`rooms`** — User rooms with walls, dimensions, floor plan/photo URLs
- **`placements`** — Furniture placed in rooms with position, rotation, color
- **`layout_exports`** — Archived JSON exports
- **`chat_messages`** — Chat history per room with tool call records

All tables use RLS — users can only access their own data.

## Styling Conventions

- Warm neutral editorial theme: `bg-paper-50` (#faf7f1), `text-ink-900` (#100f0d)
- Sienna accent: `sienna-500: #9c6a3f`
- Fraunces serif display, Inter sans-serif body from Google Fonts
- Cards: `.panel` → `bg-paper-100/70 border border-ink-900/10 backdrop-blur rounded-lg`
- Buttons: `.btn-ink` (solid dark), `.btn-ghost` (outline), `.btn-sienna` (accent)
- All buttons include `focus-visible:ring-2` for keyboard accessibility
- `prefers-reduced-motion` is respected globally via CSS and Framer Motion
- Tailwind utility classes only — no CSS modules

## Notable Behaviors

- Furniture can be rotated freely in the 2D editor via the Konva transformer handle, 15° toolbar nudges, or the in-canvas rotation slider.
- The 3D viewer prefers real GLB assets from `model_url` and will request Meshy generation from `image_url` when a placement has no model yet.
- Floorplan upload uses a 3-stage pipeline: (1) 20×20 grid overlay drawn on image, (2) GPT-5.4 identifies rooms via grid coordinates, (3) OpenCV wall-snap aligns each bbox edge to the nearest architectural wall. Results are normalized into editable `zones` stored in room-local coordinates.
- GPT-5.4 also reads dimension labels from the floorplan (e.g., 13'-4" X 9'-0") and pre-populates room widthIn/depthIn in the RoomEditor.
- The studio canvas supports room-focused editing: selecting a zone zooms the center pane to that room, constrains furniture placement to the selected room, and exposes draggable/resizable color-coded room boxes plus a bottom room inspector.
- Client-side route changes reset the window scroll position to the top so navigation between Home, Upload, and Studio never preserves mid-page scroll offsets.
- The homepage uses eased, staggered Framer Motion reveals with reduced-motion fallbacks so sections enter smoothly without abrupt jumps.
- Toast notifications (`react-hot-toast`) are used throughout for all user-facing feedback (export success, validation results, add-to-room, etc.).
- All pages have proper `<title>` and `<meta description>` via `react-helmet-async` for SEO.
- A 404 page is shown for unknown routes instead of a silent redirect.
- All destructive actions (room delete) use a styled `ConfirmModal` instead of `window.confirm`.
- The server uses `helmet` for security headers, `express-rate-limit` for rate limiting (120 req/min general, 20/15min for auth), and graceful shutdown on SIGTERM.
- Structured logging (`services/logger.js`) replaces raw `console.log/error` in server code.
- The build uses manual Rollup chunks to split React, Konva, Three.js, Framer Motion, and Supabase into separate vendor bundles for optimal caching.
- A skip-to-content link is rendered before the header for keyboard/screen-reader accessibility.
- **Guest / Draft Mode**: Upload and Studio pages are accessible without authentication. Guests create local "draft" rooms stored in localStorage via Zustand `persist`. The `StudioToolbar` shows a "Save to account" button that opens a `LoginModal` inline. On save, `saveDraftToAccount()` pushes the room, zones, and placements to the server. The guest upload path uses `/api/public/parse-floorplan` to avoid auth. 401 responses from the API are silently handled (no redirect).

## Chatbot Function Calling

The chat endpoint supports 10 layout manipulation functions via LLM tool use:
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

## Agent Guidelines

- **Client code** goes in `client/src/` — React components, hooks, utils
- **Server code** goes in `server/` — Express routes, services, middleware
- **Python AI code** goes in `python/` — FastAPI endpoints, CV/ML services
- Use `@/` import alias for client code (resolves to `client/src/`)
- All API calls from client go through `client/src/lib/api.js` (auto-JWT)
- Environment variables come from `.env` files — never hardcode secrets
- Server gracefully handles missing API keys (returns stubs/warnings)
- Run `cd client && npx vite build` to verify client compiles
- **Update this AGENTS.md file whenever changes are made**
