# Vision Studio

Full-stack AI-assisted spatial layout for interior design: upload floor plans or room photos, detect room geometry, browse real IKEA/Ashley catalog furniture, edit layouts in a 2D Konva canvas, preview in 3D, chat with layout-aware assistants, and export JSON/SVG/DXF. Built for CSE 115A (UCSC).

**Maintainers:** [AGENTS.md](./AGENTS.md) is the detailed source of truth for file paths, env vars, database schema, and agent conventions. This README is the product-oriented overview—features, APIs, and where each tool is wired in the app.

---

## Stack

| Area | Technology |
|------|------------|
| App UI | React 18 + Vite 5 + React Router 6 + Tailwind 3 |
| Canvas | Konva + react-konva (drag, resize, rotate, zone overlays) |
| State | Zustand (`layoutStore.js`, guest draft persist) |
| 3D | React Three Fiber + drei; Kenney CC0 GLBs + procedural fallbacks |
| API | Express 4 (ESM), Helmet, rate limits, image proxy |
| AI (Node) | OpenAI `gpt-5.4` + 15 chat function tools (`llmRouter.js`, `chatFunctions.js`) |
| Layout engine | Deterministic constraint placement (`layoutGenerator.js`, `autoArrange.js`, `overlapResolver.js`) |
| AI (Python) | FastAPI — floorplan vision parse, Grounding DINO + SAM 2 (`python/`) |
| Data | Supabase (Postgres, Auth, Storage); in-memory fallback when DB unavailable |

Optional **marketing** site: Next.js in `marketing/` (landing experiments).

---

## Repo layout

```text
vision-studio/
├── README.md                 # This file
├── AGENTS.md                 # Full monorepo map for developers/agents
├── client/                   # React + Vite (:5173)
├── server/                   # Express API (:3001)
│   └── services/
│       ├── chatFunctions.js  # 15 LLM layout tools
│       ├── autoArrange.js    # Auto-arrange pipeline
│       ├── layoutGenerator.js
│       ├── overlapResolver.js
│       ├── zonePlacement.js  # Active-space scoping for chat/arrange
│       └── kenneyMapping.js  # Catalog → Kenney GLB paths
├── python/                   # FastAPI (:5001)
├── marketing/                # Next.js (:3000)
├── supabase/schema.sql
└── docs/demo/                # Demo video README + output WebM
```

---

## Product flow

1. **New project** — `/studio/new` wizard or upload intake (`AnalysisWorkflow` → floorplan AI parse → `RoomEditor` zone adjust).
2. **Project vision** — Guided chips + chat at `/studio/project/:id/vision` (`ProjectVisionIntake`, `guidedVisionFlow.js`) → `globalVision` on the project.
3. **Confirm spaces** — `/studio/project/:id/confirm?mode=adjust` — rename, resize, interior/exterior types.
4. **Editor** — `/studio/project/:id/editor/:spaceId` — 2D canvas, Materials, starter furniture catalog, Space Assistant, 3D preview.
5. **Apply vision** — Explicit **Apply Vision to Layout** (Materials tab or Space Assistant callback); never silent on load (`visionDesignApply.js`).
6. **Save & export** — `Save Project` toolbar; JSON/SVG/DXF from sidebar Export tab (`useRoomExport.js`).

Guests can use drafts in `localStorage`; **Save to account** promotes drafts to Supabase via `saveDraftToAccount`.

---

## Client routes

| Path | Purpose |
|------|---------|
| `/` | Landing |
| `/login` | Auth |
| `/upload` | Redirects to `/studio/new?startMode=upload` |
| `/studio/new` | New project wizard |
| `/studio` | Project dashboard |
| `/studio/:roomId` | Legacy single-room editor |
| `/studio/project/:projectId` | Project hub (interior/exterior spaces) |
| `/studio/project/:id/vision` | Project Vision Assistant |
| `/studio/project/:id/confirm` | Review/adjust spaces (`?mode=adjust`) |
| `/studio/project/:id/editor` | Full-floorplan editor |
| `/studio/project/:id/editor/:spaceId` | Editor scoped to one space tab |
| `/studio/project/:id/chat` | Project Assistant (full page) |
| `/chat` | Global design inspiration chat (no project scope) |

Navbar/footer are hidden on editor, vision, and project chat routes.

---

## Local setup

### Install

```bash
cd client && npm install
cd ../server && npm install
cd ../marketing && npm install   # optional
cd ../python && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

### Environment

- **Server + Python** — root `.env` (copy from `.env.example`). Real `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for persistence; placeholders enable **in-memory demo mode**.
- **Client** — `client/.env.local`: `VITE_API_URL`, public Supabase keys only. Never put `OPENAI_API_KEY` or service-role keys in Vite env.
- **Marketing** — `marketing/.env.local` if running Next app.

| Service | Typical host | Required env |
|---------|--------------|--------------|
| Client | Vercel / `:5173` | `VITE_API_URL`, `NEXT_PUBLIC_SUPABASE_*` |
| API | Render / `:3001` | `OPENAI_API_KEY`, Supabase, `PYTHON_SERVICE_URL`, CORS |
| Python AI | Render / `:5001` | `OPENAI_API_KEY`; `REPLICATE_API_TOKEN` for room-photo recognition |

### Database (optional)

```bash
node server/scripts/applySchema.js [DB_PASSWORD]
cd server && node scripts/seedFurniture.js
cd server && node scripts/setup.js   # verify env + tables + catalog
```

### Run (three processes)

```bash
cd server && npm run dev          # :3001
cd client && npm run dev            # :5173
cd python && source venv/bin/activate && uvicorn app:app --host 0.0.0.0 --port 5001 --reload
```

Health: `GET http://localhost:3001/health`, `GET http://localhost:3001/api/status`, `GET http://localhost:5001/health`.

---

## API reference (Express `:3001`)

### Core

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | API uptime and version |
| GET | `/api/status` | Per-table Supabase connectivity (or `unconfigured`) |
| GET | `/api/proxy-image?url=` | CORS proxy for catalog images (WebGL textures) |

### Auth

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/auth/me` | Current user (JWT) |

### Rooms & projects

| Method | Route | Description |
|--------|-------|-------------|
| POST/GET/PUT/DELETE | `/api/rooms`, `/api/rooms/:id` | Room CRUD + zones, walls, `interior` |
| POST | `/api/rooms/:id/upload-floorplan` | Floorplan upload → Python parse → persist zones |
| POST | `/api/rooms/:id/calibrate` | Two-point scale calibration |
| GET/POST/PUT/DELETE | `/api/projects`, `/api/projects/:id` | Project metadata + `global_vision` |
| POST/PUT/DELETE | `/api/projects/:projectId/spaces/...` | Interior/exterior spaces linked to rooms |

### Furniture catalog & placements

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/furniture/catalog` | Search IKEA/Ashley catalog (`?category`, `?q`, `?provider`) |
| GET | `/api/furniture/catalog/:id` | Single catalog item |
| GET | `/api/furniture/categories` | Distinct categories |
| POST/PUT/DELETE | `/api/furniture/placements` | Placements with `zone_id`, position, rotation |

### Layout (deterministic + auto-arrange)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/layout/room-types` | Constraint templates: `bedroom`, `living_room`, `office`, `dining_room`, `studio` |
| POST | `/api/layout/generate` | Rule-based layout from `{ room_type, room, furniture? }` — no LLM |
| POST | `/api/layout/auto-place` | **Auto-Arrange**: plan → constraint placement → de-overlap (`autoArrange.js`); accepts `zone_id` for active space tab |
| POST | `/api/layout/validate` | Overlap and bounds check with clearance |

### Chat (agentic assistant)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/chat/message` | OpenAI `gpt-5.4` + up to 5 rounds of tool calls; guest/draft via `room_context`; space-scoped via `zone_id` + `zone_context` |

### Public, recognition, export, 3D (optional)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/public/parse-floorplan` | Guest floorplan parse (no DB write) |
| POST | `/api/recognition/room-photo/:room_id` | Grounding DINO object detection |
| POST | `/api/recognition/click-segment` | SAM 2 click segmentation |
| POST | `/api/export/{json\|svg\|dxf}/:room_id` | Layout export (draft routes under `/draft`) |
| POST/GET | `/api/models/*` | Meshy v2 image-to-3D (legacy; Kenney GLBs are default) |

---

## Python AI service (`:5001`)

| Method | Route | Description | Called from |
|--------|-------|-------------|-------------|
| GET | `/health` | Service + OpenAI key status | Deploy checks |
| POST | `/parse-floorplan` | GPT vision 20×20 grid + OpenCV wall-snap → zones | `server` → `floorplanParse.js` → `AnalysisWorkflow` upload |
| POST | `/detect-objects` | Grounding DINO labels on room photo | `/api/recognition/room-photo` |
| POST | `/segment-room` | SAM 2 masks from click bboxes | `/api/recognition/click-segment` |

Floorplan parse requires `OPENAI_API_KEY`. Room-photo routes require `REPLICATE_API_TOKEN`.

---

## Tools & integrations

This section maps **what each capability does** and **where it lives in the product**.

### A. Chat function tools (15 tools)

Dispatched by `POST /api/chat/message` → `server/services/chatFunctions.js` → `executeFunction()`. The model is `gpt-5.4` via `server/services/llmRouter.js`. Multi-turn: up to **5** tool rounds per user message; placements are re-fetched between rounds on persisted rooms.

**Space scoping:** Editor assistants send `zone_id` and `zone_context` so add/remove/arrange/furnish target the **active space tab** (`ChatPanel.jsx`, `zonePlacement.js`).

| Tool | What it does | Server implementation | Where integrated (UI) |
|------|----------------|----------------------|------------------------|
| `move_furniture` | Move a placed item to `(x, y)` inches | Updates `placements` row / fallback store | **Space Assistant** sidebar (`ChatPanel.jsx`); **Project Assistant** (`/studio/project/:id/chat`, `Chat.jsx`); draft rooms apply patches locally from action results |
| `rotate_furniture` | Set rotation to 0/90/180/270° | Same | Same as above |
| `add_furniture` | Add catalog item by name; auto slot in active zone if coords omitted | `dbInsertPlacement` + `findOpenSlotInZone` | Same; also populates **Recommended** tab when combined with `suggest_furniture` |
| `remove_furniture` | Delete one placement by fuzzy name | `DELETE` placement | Same |
| `swap_furniture` | Replace in-room item with another catalog SKU at same position | Delete + insert with `zone_id` preserved | Same |
| `suggest_furniture` | Search IKEA/Ashley by category, size, provider | `GET` catalog query | Same; results → `setRecommendedItems` → legacy `CatalogPanel` Recommended tab if mounted |
| `furnish_room` | Pick catalog set for `room_type`, place + constraint-arrange in one step | `layoutGenerator.js` + `overlapResolver.js` + zone offsets | Same; **demo video** living-room furnish step |
| `arrange_room` | Re-layout **all** furniture in active space with planning + de-overlap | `autoArrange.js` (not raw LLM coordinates) | Same; draft clients receive `placements` in the tool result |
| `validate_layout` | Report overlaps, out-of-bounds, clearance issues | `validateLayout()` + zone bounds | Same; mirrors toolbar **Validate** (client-side) |
| `clear_room` | Remove all furniture in active space (zone-scoped) | Bulk delete scoped placements | Same |
| `set_style_preference` | Save style/mood/palette on `room.style_preferences` | `PUT` room metadata | Chat context for future suggestions in same room |
| `estimate_budget` | Sum catalog prices for current placements | Catalog price lookup | Chat only (read-only) |
| `get_room_summary` | Dimensions, coverage %, category counts, validation | Aggregates scoped placements | Chat only; model uses before complex requests |
| `design_advice` | LLM narrative feedback on current layout | Nested `chat()` call with room state | Chat only |
| `compare_items` | Side-by-side dimensions and price for two catalog SKUs | Catalog lookup ×2 | Chat only |

**Assistant surfaces**

| Assistant | Route / component | Context sent to `/api/chat/message` |
|-----------|-------------------|-------------------------------------|
| **Space Assistant** | Editor `ChatPanel.jsx` (toolbar toggle) | `room_id`, `project_id`, `space_id`, `zone_id`, `global_vision`, `space_vision`, draft `room_context` |
| **Project Assistant** | `/studio/project/:id/chat` (`Chat.jsx`) | Project + optional space metadata; can route layout actions when a room is loaded |
| **Project Vision** | `ProjectVisionIntake.jsx` | `global_vision` intake; chat for open-ended vision Q&A |
| **Design Inspiration** | `/chat` | Local transcript only; inspiration prompts, no project DB fields |

---

### B. Layout engine (non-chat)

| Capability | What it does | Server module | Where integrated |
|------------|--------------|---------------|------------------|
| **Auto-Arrange** | Infer room type → ordered placement plan → constraint slots → 6" clearance de-overlap | `autoArrange.js`, `overlapResolver.js` | **Studio toolbar** `Auto-Arrange` (`StudioToolbar.jsx` → `POST /api/layout/auto-place`); chat `arrange_room`; draft chat fallback auto-place |
| **Constraint generate** | Deterministic templates per room type (TV focal, bed on north wall, etc.) | `layoutGenerator.js` | `POST /api/layout/generate`; used inside `furnish_room` and `autoArrange` |
| **Overlap resolver** | Grid spiral + full scan; never keeps known overlaps when a free cell exists | `overlapResolver.js` | All server placement paths above |
| **Zone placement** | Active editor space bounds, `zone_id` on inserts, global/local coord conversion | `zonePlacement.js` | Chat tools, auto-place, visible furniture filter in `layoutStore.js` |
| **Client validate** | AABB overlap + room/zone bounds | `client/src/utils/collision.js` | Toolbar **Validate** (`StudioToolbar.jsx`) |

---

### C. Vision & materials

| Capability | What it does | Module | Where integrated |
|------------|--------------|--------|------------------|
| **Guided project vision** | Chip flow: mood, priorities, constraints, room focus | `guidedVisionFlow.js`, `ProjectVisionIntake.jsx` | `/studio/project/:id/vision` |
| **Apply vision to layout** | Map `globalVision` → interior colors, recommendations, grouped furniture in empty zones; respects user-edited interior unless `force` | `visionDesignApply.js` | Materials tab **Apply Vision to Layout** (`InteriorDesignPanel.jsx`); Space Assistant `onApplyVisionLayout` in `Studio.jsx` |
| **Materials / interior** | Wall paint, wallpaper, wall art, floor color | `roomInterior.js`, `InteriorDesignPanel.jsx` | Editor sidebar Materials tab; 2D floor fill (`RoomCanvas`); 3D floor (`RoomInterior3D.jsx`) |
| **Floorplan AI parse** | Rooms as rects or polygons on uploaded plans | `python/services/floorplan_parser.py` | `AnalysisWorkflow.jsx` → `/api/public/parse-floorplan` (guest) or `/api/rooms/:id/upload-floorplan` |

---

### D. Editor & catalog (non-AI)

| Capability | What it does | Module | Where integrated |
|------------|--------------|--------|------------------|
| **Starter catalog** | 9 click-to-place templates (sofa, bed, desk, …) with Kenney GLBs | `furnitureCatalog.js`, `FurnitureCatalogPanel.jsx` | Editor sidebar **Furniture** tab → click canvas (`RoomCanvas.jsx`) |
| **API catalog (legacy panel)** | Drag/add IKEA/Ashley from search | `CatalogPanel.jsx` | Reference implementation; editor uses starter catalog + chat for API items |
| **2D canvas** | Pan/zoom, drag, resize, rotate, zones, wall tools | `RoomCanvas.jsx`, `FurnitureItem.jsx` | Project/room editor |
| **3D preview** | GLB or procedural furniture; orbit / walkthrough presets | `RoomViewer3D.jsx`, `ProjectViewer3D.jsx` | Toolbar 2D/3D toggle |
| **Export** | JSON, SVG, DXF | `useRoomExport.js`, `server/services/exportFormats.js` | Sidebar **Export** tab |
| **Undo/redo** | Furniture snapshots | `layoutStore.js` | Toolbar |

---

## Demo video

Recorded walkthrough (~90s, 60fps live path): see **[docs/demo/README.md](./docs/demo/README.md)**.

```bash
cd e2e && npm install && npm run demo:live   # real OpenAI parse + chat; needs all three services
cd e2e && npm run demo                        # offline mocks for CI
```

Output: `docs/demo/vision-studio-demo.webm` (gitignored).

---

## Testing

```bash
cd client && npx vite build
cd server && npm run test:e2e     # 12 API smoke tests (fallback mode OK)
cd server && npm test           # Vitest: layout, auto-arrange, zone placement, save/load
cd client && npm test             # Vitest: store, catalog, vision apply (if configured)
cd e2e && npm test                # Playwright editor smoke (gitignored package)
node server/services/kenneyMapping.js   # verify GLB paths for seeded catalog
node server/scripts/checkFloorplanAi.js # optional live floorplan parse check
```

---

## 3D assets

**Kenney Furniture Kit** — [kenney.nl/assets/furniture-kit](https://kenney.nl/assets/furniture-kit) (CC0). Bundled under `client/public/models/kenney/`. API catalog items resolve via `server/services/kenneyMapping.js`.

---

## Credits

CSE 115A Spring 2026 — William Liu, Ethan Cao, Sriya Katreddi, Ashley Kim.
