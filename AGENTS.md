# AGENTS.md — Vision Studio

> **Keep this file up to date.** Every time changes are made to the codebase (new files, renamed modules, added dependencies, architectural shifts), update this document to reflect the current state.

## Project Overview

**Vision Studio** is a full-stack AI-powered spatial layout design application. Users can upload floor plans or room photos, get AI-detected room geometry and furniture, browse real IKEA/Ashley catalogs, drag-and-drop furniture in a 2D Konva editor, chat with an AI assistant for layout suggestions, and export to JSON/SVG/DXF. Built for CSE 115A Spring 2026 Capstone at UCSC by William Liu, Ethan Cao, Sriya Katreddi, and Ashley Kim.

### Current Phase

Full-stack implementation — monorepo with React client, Express server, and FastAPI Python AI microservice. Supabase for auth, database, and storage.

## Tech Stack

| Layer         | Technology                                    |
| ------------- | --------------------------------------------- |
| Client        | React 18.3 + Vite 5.3 + react-router-dom 6   |
| 2D Canvas     | Konva 9.3 + react-konva 18.2 + Transformer    |
| State         | Zustand 4.5                                   |
| Styling       | Tailwind CSS 3.4 (warm neutral theme)         |
| Server        | Express 4.19 (Node.js, ES modules)            |
| AI/LLM        | OpenAI Codex 5.3 (function calling)               |
| Python AI     | FastAPI + OpenAI Codex 5.3 Vision (primary room analysis) + Replicate (Grounding DINO + SAM 3) + OpenCV fallback (distance transform + watershed room segmentation) |
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
│       ├── App.jsx               # BrowserRouter — /, /dashboard, /editor/:roomId
│       ├── index.css             # Tailwind directives + base body styles
│       ├── lib/
│       │   ├── supabaseClient.js # Supabase client singleton
│       │   └── api.js            # Axios + JWT interceptor + 401 auto-signout
│       ├── hooks/
│       │   └── useAuth.js        # Auth state, signInWithOtp, signOut
│       ├── store/
│       │   └── layoutStore.js    # Zustand: room, furniture, detections, chat, view state
│       ├── utils/
│       │   ├── constants.js      # Grid snap, clearance, category colors
│       │   ├── scale.js          # px↔inches conversion, snap-to-grid
│       │   ├── collision.js      # AABB detection, overlap check, room bounds
│       │   └── exportLayout.js   # Build JSON export schema
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Navbar.jsx        # Top nav (Home/Upload/Studio), scroll-aware
│       │   │   └── Footer.jsx        # Editorial footer (hidden in /studio)
│       │   ├── canvas/
│       │   │   ├── RoomCanvas.jsx    # Konva Stage with zoom/pan, room-zone overlays, and free-angle rotation controls
│       │   │   ├── FurnitureItem.jsx # Draggable/rotatable Konva Group with Transformer-based free rotation
│       │   │   ├── WallOutline.jsx   # Wall polygon/segment renderer
│       │   │   └── GridOverlay.jsx   # 6" snap grid
│       │   ├── upload/
│       │   │   └── AnalysisWorkflow.jsx # 6-step animated floor-plan pipeline overlay
│       │   ├── studio/
│       │   │   ├── StudioToolbar.jsx # Undo/Redo/Grid/Validate/Auto-Arrange/2D/3D/Export/Chat
│       │   │   └── RoomSetupModal.jsx # Template + dimensions picker
│       │   ├── catalog/
│       │   │   └── CatalogPanel.jsx  # Search + category chips + Recommended tab
│       │   ├── viewer/
│       │   │   ├── RoomViewer3D.jsx  # React Three Fiber — floor/walls/GLB furniture + OrbitControls
│       │   │   └── SmartFurnitureModel.jsx # Loads model_url GLBs or backfills via Meshy from product images
│       │   └── chatbot/
│       │       └── ChatPanel.jsx     # Agentic chat, 5 quick actions, auto-refresh on mutate
│       └── pages/
│           ├── Home.jsx              # Editorial landing (Batako-inspired: hero, process, quote band, services, CTA)
│           ├── Upload.jsx            # Drop-zone → AnalysisWorkflow → /studio/:roomId
│           └── Studio.jsx            # Room dashboard + 3-panel editor (catalog / canvas|3D / chat)
│
├── server/                       # Node.js + Express backend
│   ├── package.json
│   ├── index.js                  # Express entry, CORS, route mounting
│   ├── .env.example              # Template for server env vars
│   ├── config/
│   │   ├── env.js                # dotenv loader (must be imported first)
│   │   └── defaults.js           # Hardcoded defaults, furniture bounds, colors
│   ├── middleware/
│   │   ├── auth.js               # Supabase JWT verification
│   │   └── errorHandler.js       # Centralized error handling
│   ├── routes/
│   │   ├── auth.js               # GET /api/auth/me
│   │   ├── rooms.js              # CRUD + floor plan upload + calibrate
│   │   ├── furniture.js          # Catalog search + placements CRUD
│   │   ├── layout.js             # LLM auto-placement + validation
│   │   ├── chat.js               # Codex 5.3 agentic chat (8 tools: move/rotate/suggest/add/remove/validate/arrange/swap)
│   │   ├── models.js             # Meshy API v2 image-to-3D GLB generation
│   │   ├── recognition.js        # Room photo → DINO detection + SAM click-segment
│   │   └── export.js             # JSON/DXF/SVG download endpoints
│   ├── services/
│   │   ├── supabase.js           # Admin client (service role key)
│   │   ├── fallbackStore.js      # In-memory store when Supabase unavailable
│   │   ├── llmRouter.js          # OpenAI Codex 5.3 chat completions + function calling
│   │   └── exportFormats.js      # Build JSON, SVG, DXF export payloads
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

### Python (`python/.env`)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (required for Codex 5.3 Vision room analysis)
- `REPLICATE_API_TOKEN`
- `PORT` (default: 5001)

## State Management (Zustand)

Store in `client/src/store/layoutStore.js`:

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

Actions: `loadRoom`, `createRoom`, `saveRoomGeometry`, `updateRoom`, `addFurniture`, `updateFurniture`, `removeFurniture`, `rotateFurniture`, `selectFurniture`, `clearSelection`, `setDetections`, `confirmDetection`, `dismissDetection`, `addChatMessage`, `clearChat`, `setRecommendedItems`, `clearRecommendedItems`, `setViewMode`, `toggleGrid`, `toggleChat`, `undo`, `redo`, `setActiveZone`, `saveZones`, `addZone`, `updateZone`, `removeZone`, `getVisibleFurniture`.

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
| POST | `/api/chat/message` | Agentic chat (LLM + 8 function tools) |
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

- Warm neutral theme: `bg-surface-50` (#f5f4f0), `text-stone-800`
- Brand blue accent: `brand-500: #2563eb`, `brand-600: #1d4ed8`
- Inter font family from Google Fonts
- Cards: `bg-white rounded-xl shadow-sm border border-stone-200`
- Tailwind utility classes only — no CSS modules

## Notable Behaviors

- Furniture can be rotated freely in the 2D editor via the Konva transformer handle, 15° toolbar nudges, or the in-canvas rotation slider.
- The 3D viewer prefers real GLB assets from `model_url` and will request Meshy generation from `image_url` when a placement has no model yet.
- Floorplan upload normalizes detected rooms into editable `zones` stored in room-local coordinates so GPT vision room segmentation can be rendered directly in the studio canvas.

## Chatbot Function Calling

The chat endpoint supports 8 layout manipulation functions via LLM tool use:
- `move_furniture` — Move item to (x, y) position
- `rotate_furniture` — Rotate to 0/90/180/270°
- `suggest_furniture` — Query catalog by category, size, provider
- `add_furniture` — Add catalog item to room at computed position
- `remove_furniture` — Remove item from room
- `validate_layout` — Check overlaps and bounds
- `arrange_room` — AI auto-arrange all furniture (uses nested LLM call)
- `swap_furniture` — Replace one item with another from catalog

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
