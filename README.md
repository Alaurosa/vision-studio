# Vision Studio

Vision Studio is a full-stack spatial layout design application for uploading room photos or floor plans, generating AI-assisted room geometry, placing real furniture, previewing layouts in 2D and 3D, and exporting finished designs.

## Stack

- Frontend: React + Vite + React Router + Tailwind CSS
- Canvas: Konva + react-konva
- 3D Viewer: React Three Fiber + drei
- Backend: Express
- AI Service: FastAPI
- Data/Auth/Storage: Supabase

## Repo Layout

```text
vision-studio/
├── README.md
├── AGENTS.md
├── CLAUDE.md
├── client/     # React + Vite frontend
├── server/     # Express API
├── python/     # FastAPI AI service
└── supabase/   # SQL schema and setup assets
```

## App Routes

- `/` — marketing / landing page
- `/upload` — upload and analysis flow
- `/studio` — design workspace
- `/studio/:roomId` — room-specific studio session

## Local Development

### 1. Install dependencies

```bash
cd client && npm install
cd ../server && npm install
cd ../python && pip install -r requirements.txt
```

### 2. Configure environment variables

Create these files before running the app:

- `client/.env.local`
- `root/.env`
- `python/.env`

Typical values:

```bash
# client/.env.local
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
VITE_API_URL=http://localhost:3001

# root/.env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_PUBLIC_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
REPLICATE_API_TOKEN=...
MESHY_API_KEY=...
PORT=3001
PYTHON_SERVICE_URL=http://localhost:5001

# python/.env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
REPLICATE_API_TOKEN=...
PORT=5001
```

### 3. Run the services

```bash
# frontend
cd client && npm run dev

# backend
cd server && npm run dev

# python AI service
cd python && uvicorn app:app --host 0.0.0.0 --port 5001
```

Default local addresses:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Python AI service: `http://localhost:5001`

## Core Features

- Upload floor plans and room photos
- AI-assisted floorplan parsing and object detection
- Furniture catalog browsing and placement
- 2D room editing with grid, snapping, and collision checks
- 3D room preview with generated or catalog-backed models
- Chat-driven layout assistance
- Export to JSON, DXF, and SVG

## Useful Commands

```bash
cd server && npm run setup
cd server && npm run seed
cd server && npm run generate-models
```

## Notes

- The repository includes a legacy `app/` reference in documentation only; the active frontend lives in `client/`.
- `.next/`, local env files, and dependency folders are ignored and should not be committed.