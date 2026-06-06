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
- **Client** (`client/.env.local`, see `client/.env.example`): `VITE_API_URL` and public Supabase keys only (`NEXT_PUBLIC_SUPABASE_*` or `VITE_*`). **Do not** put `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, or service-role keys in Vite env vars.
- **Marketing**: `marketing/.env.local` if you run the Next app.

**Deployed (typical):**

| Service | Host | Env |
| -------- | ------ | ----- |
| Frontend | Vercel | `VITE_API_URL`, `VITE_SUPABASE_*` / `NEXT_PUBLIC_SUPABASE_*` |
| API | Render `vision-studio-server` | `OPENAI_API_KEY`, Supabase, `PYTHON_SERVICE_URL`, CORS (`CLIENT_ORIGIN`, `ALLOW_VERCEL_PREVIEWS`, etc.) |
| AI | Render `vision-studio-python` | `OPENAI_API_KEY`; `REPLICATE_API_TOKEN` only if room-photo endpoints are used |

### Editor pipeline (no silent vision apply)

Project Vision (guided chips) → **Apply Vision to Layout** (explicit) → Materials (manual edits protected) → furniture placement → 2D Konva / 3D preview. See **AGENTS.md** for full behavior.

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
cd server && npm run test:e2e            # API smoke (12 in-process tests; works in fallback mode)
cd server && npm test                    # All server Vitest (save/load skips without real Supabase)
cd server && npm run test:watch
cd marketing && npm run build && npm run lint
node server/services/kenneyMapping.js    # verify catalog → Kenney GLB paths
```

Browser Playwright smoke and demo video tooling live under `e2e/` and are **gitignored** (not needed to run the app). Demo outputs: `docs/demo/*.webm` (README may be kept).

There is **no** `npm run generate-models` in this repo; optional 3D generation is the Meshy route under `/api/models` (see AGENTS.md).

## Final Submission Documentation

CSE 115A capstone deliverables for graders and TAs (`release/final-submission` branch).

### Scrum and process

| Document | Path |
|----------|------|
| Release Plan | *Not yet in repo* — add `docs/scrum/release-plan.pdf` or `.md` |
| [Sprint 1 Plan](docs/scrum/sprint-1-plan.pdf) | `docs/scrum/sprint-1-plan.pdf` |
| [Sprint 1 Report](docs/scrum/sprint-1-report.pdf) | `docs/scrum/sprint-1-report.pdf` |
| Sprint 2 Plan | *Not yet in repo* |
| [Sprint 2 Report](docs/scrum/sprint-2-report.pdf) | `docs/scrum/sprint-2-report.pdf` |
| [Sprint 3 Plan](docs/scrum/sprint-3-plan.pdf) | `docs/scrum/sprint-3-plan.pdf` |
| [Sprint 3 Report](docs/scrum/sprint-3-report.pdf) | `docs/scrum/sprint-3-report.pdf` |
| [Sprint 4 Plan](docs/scrum/sprint-4-plan.pdf) | `docs/scrum/sprint-4-plan.pdf` |
| Sprint 4 Report | *Not yet in repo* |
| Team Working Agreement | *Not yet in repo* — add `docs/scrum/team-working-agreement.md` or `.pdf` |
| [Definition of Done](docs/scrum/definition-of-done.pdf) | `docs/scrum/definition-of-done.pdf` |
| [Style Guide](docs/scrum/style-guide.md) | `docs/scrum/style-guide.md` |

### Testing and release

| Document | Path |
|----------|------|
| [Test Plan and Report](docs/testing/test-plan-and-report.pdf) | `docs/testing/test-plan-and-report.pdf` |
| [Release Summary](docs/release/release-summary.pdf) | `docs/release/release-summary.pdf` |

### Product and technical docs

| Document | Path |
|----------|------|
| [User Guide](docs/user-guide/user-guide.md) | `docs/user-guide/user-guide.md` |
| [Architecture Overview](docs/design/architecture-overview.md) | `docs/design/architecture-overview.md` |
| [Data Model](docs/design/data-model.md) | `docs/design/data-model.md` |
| [Editor UX Flow](docs/design/editor-ux-flow.md) | `docs/design/editor-ux-flow.md` |
| [Deployment Notes](docs/deployment/deployment-notes.md) | `docs/deployment/deployment-notes.md` |
| Installation instructions | This README — [Local setup](#local-setup) |
| Dependency manifests | `client/package.json`, `server/package.json`, `python/requirements.txt` |
| Environment templates | `.env.example`, `client/.env.example`, `python/.env.example` |

Technical reference for maintainers: **[AGENTS.md](./AGENTS.md)**.

### Verification commands

```bash
cd client && npm test
cd server && npm test
cd server && npm run test:e2e
cd client && npm run build
```

## Credits — 3D assets

**Kenney Furniture Kit** — [kenney.nl/assets/furniture-kit](https://kenney.nl/assets/furniture-kit) (CC0 / public domain). Bundled under `client/public/models/kenney/`.
