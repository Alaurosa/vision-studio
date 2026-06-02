# Vision Studio

Full-stack AI-assisted spatial layout: floor plans and room photos → detected geometry → IKEA/Ashley catalog furniture in a 2D Konva editor → 3D preview → JSON/SVG/DXF export. Capstone (CSE 115A, UCSC). For maintainers and agents, **[AGENTS.md](./AGENTS.md)** is the source of truth for structure, APIs, env vars, and behaviors.

## Stack (summary)

| Area | Tech |
|------|------|
| App UI | React 18 + Vite 5 + React Router 6 + Tailwind 3 |
| Canvas | Konva + react-konva |
| State | Zustand (persist for guest drafts) |
| 3D | React Three Fiber + drei; Kenney CC0 GLBs under `client/public/models/kenney/` via `server/services/kenneyMapping.js` |
| API | Express 4 (ESM), Helmet, rate limits, `/api/proxy-image` |
| AI (Node) | OpenAI `gpt-5.4` + tool calling (`server/services/llmRouter.js`) |
| AI (Python) | FastAPI — floorplan parse, DINO+SAM room photo flow (`python/`) |
| Data | Supabase (Postgres, Auth, Storage); in-memory fallback when DB/credentials unavailable |

Optional **marketing** site: Next.js in `marketing/` (see AGENTS.md).

## Repo layout

```text
vision-studio/
├── README.md
├── AGENTS.md              # Full monorepo map, routes, env, DB, conventions
├── client/                # React + Vite (:5173)
├── server/                # Express API (:3001)
├── python/                # FastAPI (:5001)
├── marketing/             # Next.js landing (:3000)
├── supabase/schema.sql    # Apply in Supabase SQL Editor (or server/scripts/applySchema.js)
└── docs/
```

## Local setup

### 1. Install

```bash
cd client && npm install
cd ../server && npm install
cd ../marketing && npm install   # optional
cd ../python && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

### 2. Environment

- **Server + Python** load the **root** `.env` (copy from `.env.example`). Real `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are required for persisted data; placeholder values (e.g. `your-project.supabase.co`) skip remote DB and run **in-memory demo mode** with fast `/api/status`.
- **Client**: `client/.env.local` — `NEXT_PUBLIC_SUPABASE_*` (or `VITE_*` aliases), `VITE_API_URL=http://localhost:3001`.
- **Marketing**: `marketing/.env.local` if you run the Next app.

### 3. Database (optional for full persistence)

Apply `supabase/schema.sql` in the Supabase SQL Editor, or:

```bash
node server/scripts/applySchema.js [DB_PASSWORD]
cd server && node scripts/seedFurniture.js
```

Verify: `cd server && node scripts/setup.js`

### 4. Run (three processes)

```bash
# Terminal 1 — API
cd server && npm run dev

# Terminal 2 — UI
cd client && npm run dev

# Terminal 3 — Python AI (floorplan upload / recognition chain)
cd python && source venv/bin/activate && uvicorn app:app --host 0.0.0.0 --port 5001 --reload
```

URLs: **5173** (client), **3001** (API), **5001** (Python). Health: `GET /health`, `GET http://localhost:5001/health`, `GET /api/status`.

## Main app routes (client)

| Path | Purpose |
|------|---------|
| `/` | Landing |
| `/login` | Auth |
| `/upload` | Redirects to `/studio/new?startMode=upload` (wizard) |
| `/studio/new` | New project wizard |
| `/studio` | Project dashboard |
| `/studio/:roomId` | Legacy single-room editor |
| `/studio/project/:projectId` | Project hub |
| `/studio/project/:id/vision` | Project vision intake |
| `/studio/project/:id/confirm` | Confirmation / adjust spaces (`?mode=adjust`) |
| `/studio/project/:id/editor` | Full-floorplan editor |
| `/studio/project/:id/editor/:spaceId` | Editor scoped to a space |
| `/studio/project/:id/chat` | Project assistant (full page) |
| `/chat` | Global design inspiration chat |

Navbar/footer are hidden on editor, vision, and project chat (see `client/src/App.jsx`).

## Useful commands

```bash
cd client && npx vite build              # production build check
cd server && npm install                 # Vitest + Supertest
cd server && npm run test:e2e            # API E2E smoke (works in demo/fallback mode)
cd server && npm test                    # E2E + save/load (save/load skips without real Supabase)
cd server && npm run test:watch
cd marketing && npm run build && npm run lint
node server/services/kenneyMapping.js    # verify catalog → Kenney GLB paths
```

There is **no** `npm run generate-models` in this repo; optional 3D generation is the Meshy route under `/api/models` (see AGENTS.md).

## Credits — 3D assets

**Kenney Furniture Kit** — [kenney.nl/assets/furniture-kit](https://kenney.nl/assets/furniture-kit) (CC0 / public domain). Bundled under `client/public/models/kenney/`.
