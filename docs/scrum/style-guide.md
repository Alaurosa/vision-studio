# Vision Studio — Style Guide

**CSE 115A Capstone · UCSC Spring 2026**

This document captures the coding and collaboration conventions used in the Vision Studio repository. Rules here reflect actual project practice — not aspirational standards that conflict with the codebase.

**Team:** William Liu, Ethan Cao, Sriya Katreddi, Ashley Kim (UCSC).

---

## 1. Formatting (Prettier)

All JavaScript/JSX/JSON is formatted with Prettier using `.prettierrc`:

| Rule | Value |
|------|-------|
| Quotes | Single (`'`) |
| Semicolons | Yes |
| Trailing commas | ES5 (objects/arrays; not function params) |
| Indent | 2 spaces (`tabWidth: 2`) |
| Print width | 100 characters |
| Arrow parens | Always `(x) => x` |
| End of line | LF |

Run formatting before committing. The repo does not enforce a pre-commit hook by default — apply Prettier manually or via editor integration.

---

## 2. Repository Layout

| Code type | Location |
|-----------|----------|
| React client | `client/src/` |
| Express server | `server/` (ES modules) |
| Python AI | `python/` |
| Marketing (optional) | `marketing/src/` |
| Database schema | `supabase/schema.sql` |
| Documentation | `docs/` |
| Maintainer reference | `AGENTS.md` (keep updated when architecture changes) |

**Import alias:** Client code uses `@/` → `client/src/` (configured in `vite.config.js` and `vitest.config.js`).

---

## 3. JavaScript / React Conventions

### 3.1 Modules

- Client and server use **ES modules** (`"type": "module"` in `package.json`).
- Prefer named exports for utilities; default export for React page/component files.

### 3.2 Component naming

| Item | Convention | Example |
|------|------------|---------|
| React components | PascalCase filename + export | `RoomCanvas.jsx`, `EditorWorkspaceSidebar.jsx` |
| Hooks | camelCase, `use` prefix | `useAuth.js`, `useRoomExport.js` |
| Utilities | camelCase filename | `collision.js`, `furniture3d.js` |
| Store | camelCase | `layoutStore.js` |
| Data modules | camelCase | `furnitureCatalog.js`, `roomInterior.js` |

### 3.3 Component structure

- Functional components with hooks (no class components except `ErrorBoundary.jsx`).
- Co-locate component-specific styles as Tailwind utility classes — no CSS modules.
- JSDoc on non-obvious utilities and shared hooks is encouraged but not required on every component.

### 3.4 State management

- Editor state lives in **Zustand** (`layoutStore.js`).
- Use selectors for derived state (e.g. `selectVisibleFurniture`).
- Draft persistence via `zustand/persist` — only draft room payload is persisted, not session-only fields like `selectedCatalogItem`.

### 3.5 Routing

- React Router 6; lazy-loaded pages in `App.jsx`.
- Route constants and behavior documented in `AGENTS.md`.

---

## 4. Styling (Tailwind CSS)

### 4.1 Theme

Warm neutral editorial palette defined in `client/tailwind.config.js`:

| Token | Usage |
|-------|-------|
| `paper-*` | Backgrounds (`bg-paper-50`, `bg-paper-100`) |
| `ink-*` | Text and borders (`text-ink-900`) |
| `sienna-*` | Accent (`sienna-500`) |
| `font-display` | Fraunces serif (headings) |
| `font-sans` | Inter (body) |

### 4.2 Component classes

Shared patterns in `client/src/index.css`:

- `.panel` — card surface
- `.btn-ink`, `.btn-ghost`, `.btn-sienna` — buttons
- `.input-field` — form inputs
- `.eyebrow`, `.display-xl/lg/md` — typography
- `.noise` — texture overlay

### 4.3 Rules

- Tailwind utility classes only in components — no CSS modules.
- Include `focus-visible:ring-2` on interactive elements for keyboard accessibility.
- Respect `prefers-reduced-motion` (global CSS + Framer Motion reduced-motion checks).
- Editor sidebar uses some inline hex colors for IDE-style chrome — acceptable in studio components.

---

## 5. Server (Express) Conventions

### 5.1 Structure

```
server/
├── index.js          # Entry + graceful shutdown
├── app.js            # Express factory (exported for tests)
├── routes/           # One file per resource area
├── services/         # Business logic, DB, LLM, export
├── middleware/       # auth.js, errorHandler.js
├── config/           # env.js, corsOrigins.js
└── __tests__/        # Vitest + Supertest
```

### 5.2 API route conventions

| Pattern | Example |
|---------|---------|
| Prefix | `/api/<resource>` |
| Auth routes | `/api/auth/me` |
| Room CRUD | `/api/rooms`, `/api/rooms/:id` |
| Nested actions | `/api/rooms/:id/upload-floorplan` |
| Draft export | `/api/export/json/draft` (POST with body) |
| Public (no auth) | `/api/public/parse-floorplan` |
| Health | `/health`, `/api/status` |

### 5.3 Error handling and logging

- Use `services/logger.js` — not raw `console.log` in server code.
- 5xx → `error` level; 4xx → `warn` level.
- Centralized `errorHandler.js` middleware.
- Structured JSON log fields where applicable.

### 5.4 Auth

- `requireAuth` for protected routes.
- `optionalAuth` for guest/draft chat and public-adjacent flows.
- Test token: `Bearer vs-test-token-001` → `test@visionstudio.dev`.
- Invalid real JWTs return **401** — never silently downgrade to guest.

### 5.5 Database access

- Admin client in `services/supabase.js` (service role key).
- `useDb()` helper in `services/db.js` — falls back to `fallbackStore.js` when unconfigured.
- `placementPersistence.js` retries without optional columns when schema cache is stale.

---

## 6. Environment Variable Naming

| Surface | Prefix | Examples |
|---------|--------|----------|
| Vite client | `VITE_*`, `NEXT_PUBLIC_*` | `VITE_API_URL`, `NEXT_PUBLIC_SUPABASE_URL` |
| Express server | No prefix | `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CLIENT_ORIGIN` |
| Python | No prefix | `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, `PORT` |

**Rules:**

- Never commit `.env` or `client/.env.local` with real secrets.
- Templates live in `.env.example`, `client/.env.example`, `python/.env.example`.
- Server and Python load root `.env`; client reads Vite env only.

---

## 7. Python Service Conventions

### 7.1 Structure

```
python/
├── app.py                    # FastAPI entry
├── requirements.txt          # Pinned dependencies
└── services/
    ├── floorplan_parser.py
    └── object_recognition.py
```

### 7.2 Style

- FastAPI with typed endpoints and `HTTPException` for client errors.
- Load env from root `.env` first, then `server/.env`, then `python/.env`.
- Async endpoints for I/O-bound AI calls.
- Constants for model identifiers (e.g. `SAM3_MODEL` for SAM 2 via Replicate).

### 7.3 Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Service check |
| POST | `/parse-floorplan` | Floor plan upload |
| POST | `/detect-objects` | Room photo detection |
| POST | `/segment-room` | Click segmentation |

Python is called by Express only — not directly by the browser in production.

---

## 8. Testing Expectations

### 8.1 Client (Vitest)

- Config: `client/vitest.config.js` + `client/src/test/setup.js`
- Tests in `client/src/**/__tests__/`
- Coverage includes: catalog data, collision, 3D helpers, layout store, key components
- Run: `cd client && npm test`
- **Note:** `layoutStore` uses `zustand/persist` — tests need `localStorage` mock in setup

### 8.2 Server (Vitest + Supertest)

- Config: `server/vitest.config.js` (node env, in-band, 30s timeout)
- API smoke: `server/__tests__/e2e.smoke.test.js` — **12 in-process tests**
- Run smoke: `cd server && npm run test:e2e`
- `saveLoad.test.js` skips without real Supabase credentials
- Smoke tests work in in-memory fallback mode

### 8.3 Browser E2E

- Playwright tooling under `e2e/` is **gitignored** — local dev only, not CI-required.

### 8.4 Build verification

```bash
cd client && npx vite build     # must compile
cd marketing && npm run lint    # if marketing changed
```

---

## 9. Git, Commits, and Pull Requests

### 9.1 Branching

- Feature branches off `main` (or team-agreed default).
- Keep PRs focused — one feature or fix per PR when possible.

### 9.2 Commit messages

Follow repository history style: concise, imperative, focused on **why**:

```
Add explicit save button to studio toolbar
Fix CORS for Vercel preview deployments
Update AGENTS.md for project editor routes
```

Avoid vague messages (`fix stuff`, `wip`).

### 9.3 Pull request expectations

- Describe what changed and how to test it.
- Note env var or schema changes explicitly.
- Update `AGENTS.md` when adding routes, tables, dependencies, or architectural shifts.
- Run relevant tests before requesting review:
  - `cd server && npm run test:e2e` for API changes
  - `cd client && npm test` for client logic changes
  - `cd client && npx vite build` for UI changes

### 9.4 Documentation

- Update `AGENTS.md` for maintainer-facing architecture changes.
- Update `docs/` for submission-facing documentation changes.
- Do not commit secrets, `.env` files, or `docs/demo/*.webm` recordings.

---

## 10. AI / LLM Conventions

- Model hardcoded to **`gpt-5.4`** across server (`llmRouter.js`) and Python (`floorplan_parser.py`).
- Chat tools defined in `server/services/chatFunctions.js` — 15 functions with `executeFunction()` dispatch.
- Multi-turn tool loop: up to 5 rounds; re-fetches placements between rounds.

---

## 11. 3D Assets

- Kenney Furniture Kit (CC0) in `client/public/models/kenney/`
- Catalog → GLB mapping in `server/services/kenneyMapping.js`
- Verify mappings: `node server/services/kenneyMapping.js`
- GLBs are visual-only; catalog inch dimensions are authoritative for placement

---

## 12. Definition of Done (Team Reference)

A story is **done** when:

1. Feature works in local dev (client + server + Python if AI-related).
2. Relevant tests pass (or new tests added for non-trivial logic).
3. `npx vite build` succeeds for client changes.
4. No secrets committed; env templates updated if new vars added.
5. `AGENTS.md` updated for architectural/route/DB changes.
6. PR reviewed by at least one teammate.
7. Known limitations documented if prototype-level.

See [Definition of Done](./definition-of-done.pdf) for the formal team document.

---

## 13. Related Documents

- [AGENTS.md](../../AGENTS.md) — full monorepo reference
- [.prettierrc](../../.prettierrc) — formatting config
- [Team Working Agreement](./team-working-agreement.md) *(add when available)*
- [Deployment Notes](../deployment/deployment-notes.md)
