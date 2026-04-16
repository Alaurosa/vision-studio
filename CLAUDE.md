# Vision Studio — Complete Claude Code Implementation Guide

> **READ THIS FIRST.** This is the master instruction file for Claude Code (VSCode extension).
> Work through every layer in order. After completing each layer, run the test suite and fix
> all errors before moving on. Keep iterating on each layer until it is fully functional and
> manually tested. Do not move to the next layer until the current one ships.
>
> **Goal:** A shippable, production-quality web app where a user can:
> 1. Upload a floor plan or room photo
> 2. Get an AI-generated accurate 2D room layout
> 3. Browse real furniture catalogs and place items in the room
> 4. Get AI furniture suggestions via chatbot
> 5. Export the layout to JSON / PDF / DXF / GLB
> 6. View the room in a 3D walkthrough
>
> **Team:** Ashley Kim (Product Owner), William Liu (Scrum Master), Sriya Katreddi, Ethan Cao
> **Course:** CSE 115a — Software Engineering, UCSC
> **Release Target:** June 5, 2026

---

## CLAUDE CODE DIRECTIVES

```
DIRECTIVE: After implementing each numbered layer below, run all tests in that layer's
test file. Fix every failing test before continuing. If a feature cannot be completed
due to a missing API key or external dependency, stub it with a clear TODO comment
and a working mock so the rest of the app continues to function.

DIRECTIVE: Every file you create must be placed in the exact path specified.
Do not invent alternate paths.

DIRECTIVE: After every layer is complete, start the dev servers and verify the
feature works end-to-end in the browser before marking it done.

DIRECTIVE: Keep iterating. If something does not work, debug it, fix it, and re-test.
Do not leave broken code.

DIRECTIVE: All secrets come from environment variables. Never hardcode API keys.
Never commit .env files.

DIRECTIVE: When in doubt about a design decision, prefer simplicity over cleverness.
Ship working code first, then optimize.
```

---

## ENVIRONMENT SETUP — DO THIS FIRST

### 1. Copy .env files

**`server/.env`** (fill in your keys):
```
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LLM APIs
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...

# AI Vision / 3D
REPLICATE_API_TOKEN=r8_...
MESHY_API_KEY=msy_...

# Server
PORT=3001
NODE_ENV=development
PYTHON_SERVICE_URL=http://localhost:5001
```

**`client/.env.local`**:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3001
```

**`python/.env`**:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
REPLICATE_API_TOKEN=r8_...
PORT=5001
```

### 2. Install all dependencies

```bash
# Root
cd vision-studio
npm install   # installs workspace root deps if using monorepo

# Client
cd client
npm install

# Server
cd ../server
npm install

# Python
cd ../python
pip install -r requirements.txt
```

### 3. Start all services (3 terminals)

```bash
# Terminal 1 — Python AI service
cd python && uvicorn app:app --host 0.0.0.0 --port 5001 --reload

# Terminal 2 — Node backend
cd server && npm run dev

# Terminal 3 — React frontend
cd client && npm run dev
```

---

## COMPLETE PROJECT FILE STRUCTURE

```
vision-studio/
├── CLAUDE.md                          ← THIS FILE (master instructions)
├── .gitignore
├── README.md
│
├── client/                            ← React + Vite frontend
│   ├── .env.local                     ← GITIGNORED
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── lib/
│       │   ├── supabaseClient.js      ← Supabase singleton
│       │   └── api.js                 ← Axios instance + interceptors
│       ├── store/
│       │   └── layoutStore.js         ← Zustand global state
│       ├── hooks/
│       │   ├── useAuth.js
│       │   ├── useRoom.js
│       │   └── useCollision.js
│       ├── utils/
│       │   ├── scale.js               ← px ↔ inches conversion
│       │   ├── collision.js           ← AABB detection
│       │   ├── exportLayout.js        ← Assemble JSON schema
│       │   └── constants.js           ← Hardcoded defaults
│       ├── components/
│       │   ├── auth/
│       │   │   ├── LoginPage.jsx
│       │   │   └── AuthGuard.jsx
│       │   ├── canvas/
│       │   │   ├── RoomCanvas.jsx     ← Main Konva stage
│       │   │   ├── WallOutline.jsx    ← Room boundary
│       │   │   ├── FurnitureItem.jsx  ← Draggable furniture
│       │   │   ├── GridOverlay.jsx    ← Snap grid
│       │   │   ├── RulerOverlay.jsx   ← Dimension ruler
│       │   │   └── ScaleCalibrator.jsx
│       │   ├── upload/
│       │   │   ├── FloorPlanUpload.jsx
│       │   │   └── RoomPhotoUpload.jsx
│       │   ├── catalog/
│       │   │   ├── CatalogPanel.jsx
│       │   │   ├── FurnitureCard.jsx
│       │   │   └── ProviderFilter.jsx
│       │   ├── editor/
│       │   │   ├── FurnitureEditor.jsx
│       │   │   ├── ValidationPanel.jsx
│       │   │   └── MaskEditor.jsx     ← SAM 3 click-to-select overlay
│       │   ├── chatbot/
│       │   │   ├── ChatPanel.jsx
│       │   │   └── ChatMessage.jsx
│       │   └── viewer/
│       │       └── UnityViewer.jsx
│       └── pages/
│           ├── Landing.jsx
│           ├── Dashboard.jsx
│           └── Editor.jsx
│
├── server/                            ← Node.js + Express backend
│   ├── .env                           ← GITIGNORED
│   ├── package.json
│   ├── index.js                       ← Entry point
│   ├── config/
│   │   └── defaults.js                ← All hardcoded constants
│   ├── middleware/
│   │   ├── auth.js                    ← Supabase JWT verification
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── rooms.js
│   │   ├── furniture.js
│   │   ├── layout.js
│   │   ├── chat.js
│   │   ├── export.js
│   │   └── recognition.js             ← Object recognition endpoints
│   ├── services/
│   │   ├── supabase.js                ← Supabase admin client
│   │   ├── llmRouter.js               ← GPT / Claude / Gemini unified
│   │   ├── meshy.js                   ← Meshy 3D generation
│   │   └── exportFormats.js           ← DXF, GLB, PDF export logic
│   ├── providers/
│   │   ├── ikea.js
│   │   ├── ashley.js
│   │   └── providerInterface.js
│   └── scripts/
│       └── seedFurniture.js           ← Seed IKEA + Ashley data
│
├── python/                            ← FastAPI AI microservice
│   ├── .env                           ← GITIGNORED
│   ├── requirements.txt
│   ├── app.py                         ← FastAPI entry point
│   └── services/
│       ├── floorplan_parser.py        ← OpenCV wall detection
│       ├── object_recognition.py      ← SAM 3 + Grounding DINO
│       └── scale_estimator.py         ← Pixel-to-real scale
│
└── unity/                             ← Unity 2022.3 LTS WebGL project
    ├── Assets/
    │   ├── Scripts/
    │   │   ├── RoomBuilder.cs
    │   │   ├── CameraController.cs
    │   │   └── UIManager.cs
    │   ├── Resources/
    │   │   └── Furniture/             ← GLB prefabs by category name
    │   └── Scenes/
    │       └── RoomViewer.unity
    └── ProjectSettings/
```

---

## LAYER 0 — AUTH, USER DATA, ENCRYPTION

**Goal:** User can sign up, log in with magic link email, and all their data is encrypted at rest and scoped to their account via Supabase RLS.

### 0.1 — Supabase Project Setup

Run this SQL in the Supabase SQL editor. Run it all at once.

```sql
-- ============================================================
-- VISION STUDIO — COMPLETE DATABASE SCHEMA
-- Run this entire block in Supabase SQL Editor
-- ============================================================

-- EXTENSION: UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROVIDERS TABLE
-- ============================================================
create table if not exists providers (
  id          text primary key,         -- 'ikea', 'ashley', 'wayfair', 'custom'
  name        text not null,
  base_url    text,
  logo_url    text,
  active      boolean default true,
  created_at  timestamptz default now()
);

insert into providers (id, name, base_url) values
  ('ikea',    'IKEA',             'https://www.ikea.com/us/en/'),
  ('ashley',  'Ashley Furniture', 'https://www.ashleyfurniture.com/'),
  ('wayfair', 'Wayfair',          'https://www.wayfair.com/'),
  ('custom',  'Custom Piece',     null)
on conflict do nothing;

-- ============================================================
-- FURNITURE CATALOG TABLE
-- ============================================================
create table if not exists furniture_catalog (
  id           uuid primary key default gen_random_uuid(),
  category     text not null,
  name         text not null,
  provider     text references providers(id) default 'generic',
  provider_id  text,
  width        numeric(8,2),           -- inches
  depth        numeric(8,2),           -- inches
  height       numeric(8,2),           -- inches
  price_usd    numeric(10,2),
  url          text,
  image_url    text,
  available    boolean default true,
  last_synced  timestamptz,
  created_at   timestamptz default now()
);

-- Public read access to catalog
alter table furniture_catalog enable row level security;
create policy "public catalog read" on furniture_catalog for select using (true);

-- ============================================================
-- ROOMS TABLE
-- ============================================================
create table if not exists rooms (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade,
  name                text not null default 'My Room',
  unit                text default 'inches',
  width               numeric(8,2),
  depth               numeric(8,2),
  height              numeric(8,2) default 96,
  walls               jsonb,
  scale_px_per_inch   numeric(10,4),
  floor_plan_url      text,
  room_photo_url      text,
  detected_objects    jsonb,           -- SAM3 + DINO output cache
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table rooms enable row level security;
create policy "own rooms" on rooms for all using (auth.uid() = user_id);

-- ============================================================
-- PLACEMENTS TABLE (furniture in a room)
-- ============================================================
create table if not exists placements (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid references rooms(id) on delete cascade,
  catalog_id   uuid references furniture_catalog(id),
  name         text,
  category     text,
  provider     text,
  provider_id  text,
  width        numeric(8,2),
  depth        numeric(8,2),
  height       numeric(8,2),
  x_inches     numeric(10,4) default 0,
  y_inches     numeric(10,4) default 0,
  rotation     integer default 0,
  color        text default '#d4a27a',
  custom       boolean default false,
  model_url    text,                   -- GLB model URL from Meshy
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table placements enable row level security;
create policy "own placements" on placements for all
  using (exists (
    select 1 from rooms r where r.id = placements.room_id and r.user_id = auth.uid()
  ));

-- ============================================================
-- LAYOUT EXPORTS TABLE
-- ============================================================
create table if not exists layout_exports (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid references rooms(id) on delete cascade,
  layout_json  jsonb not null,
  schema_version text default '1.0',
  created_at   timestamptz default now()
);

alter table layout_exports enable row level security;
create policy "own exports" on layout_exports for all
  using (exists (
    select 1 from rooms r where r.id = layout_exports.room_id and r.user_id = auth.uid()
  ));

-- ============================================================
-- CHAT HISTORY TABLE
-- ============================================================
create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid references rooms(id) on delete cascade,
  role        text not null,           -- 'user' | 'assistant'
  content     text not null,
  tool_calls  jsonb,                   -- LLM function calls if any
  model_used  text,                    -- 'gpt-4o' | 'claude-...' | 'gemini-...'
  created_at  timestamptz default now()
);

alter table chat_messages enable row level security;
create policy "own chat" on chat_messages for all
  using (exists (
    select 1 from rooms r where r.id = chat_messages.room_id and r.user_id = auth.uid()
  ));

-- ============================================================
-- SUPABASE STORAGE BUCKETS
-- ============================================================
-- Create these manually in Supabase Dashboard → Storage:
-- Bucket: "floor-plans"  → private, max 10MB, allow: image/*, application/pdf
-- Bucket: "room-photos"  → private, max 10MB, allow: image/*
-- Bucket: "models"       → public, max 50MB, allow: model/*, application/octet-stream
```

### 0.2 — Supabase Client (`client/src/lib/supabaseClient.js`)

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

### 0.3 — Auth Hook (`client/src/hooks/useAuth.js`)

```javascript
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useAuth() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw error;
  };

  const signOut = () => supabase.auth.signOut();

  return { user, loading, signInWithEmail, signOut };
}
```

### 0.4 — Login Page (`client/src/components/auth/LoginPage.jsx`)

```jsx
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail]   = useState('');
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmail(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md">
        <h1 className="text-3xl font-bold text-stone-800 mb-2">Vision Studio</h1>
        <p className="text-stone-500 mb-8">Spatial Layout Engine</p>

        {sent ? (
          <div className="text-center py-6">
            <p className="text-green-600 font-medium">Check your email for a login link.</p>
            <p className="text-stone-400 text-sm mt-2">You can close this tab.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
              className="w-full border border-stone-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-stone-800 text-white rounded-lg py-3 font-medium hover:bg-stone-700 transition"
            >
              Send Magic Link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

### 0.5 — Auth Guard (`client/src/components/auth/AuthGuard.jsx`)

```jsx
import { useAuth } from '../../hooks/useAuth';
import LoginPage from './LoginPage';

export default function AuthGuard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-400">Loading...</div>;
  if (!user)   return <LoginPage />;
  return children;
}
```

### 0.6 — Server Supabase Admin (`server/services/supabase.js`)

```javascript
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env');
}

// Service role client — bypasses RLS for server operations
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

### 0.7 — Auth Middleware (`server/middleware/auth.js`)

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  next();
}
```

### 0.8 — Axios Client with Auth (`client/src/lib/api.js`)

```javascript
import axios from 'axios';
import { supabase } from './supabaseClient';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Attach Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Global error handling
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) supabase.auth.signOut();
    return Promise.reject(err);
  }
);

export default api;
```

### Layer 0 — Tests

```javascript
// server/tests/auth.test.js
// Test: POST /api/auth without token → 401
// Test: POST /api/auth with valid Supabase token → passes middleware
// Test: RLS — user A cannot read user B's rooms
```

**✅ Layer 0 is complete when:** A user can sign in via magic link, is redirected to the dashboard, and all subsequent API calls include a valid JWT.

---

## LAYER 1 — BACKEND FLOOR PLAN PROCESSING

**Goal:** User uploads a floor plan image (JPEG/PNG/PDF). The system parses it with OpenCV to extract wall geometry, then cleans the segmentation with SAM 3. Returns a polygon array in real-world inches.

### 1.1 — Python Requirements (`python/requirements.txt`)

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
opencv-python-headless==4.10.0.84
numpy==1.26.4
Pillow==10.3.0
python-multipart==0.0.9
python-dotenv==1.0.1
replicate==0.31.0
supabase==2.5.0
httpx==0.27.0
pdf2image==1.17.0
pydantic==2.7.0
```

### 1.2 — FastAPI App (`python/app.py`)

```python
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from services.floorplan_parser import parse_floorplan
from services.object_recognition import detect_objects, segment_room
from services.scale_estimator import estimate_scale_from_image

app = FastAPI(title="Vision Studio AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "service": "vision-studio-ai"}

@app.post("/parse-floorplan")
async def parse_floorplan_endpoint(file: UploadFile = File(...)):
    """
    Accepts a floor plan image (JPEG, PNG) or PDF.
    Returns detected wall polygon points in pixel coordinates.
    """
    allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if file.content_type not in allowed:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    contents = await file.read()
    result = await parse_floorplan(contents, file.content_type)
    return result

@app.post("/detect-objects")
async def detect_objects_endpoint(
    image_url: str = Form(...),
    labels: str = Form(default="sofa,chair,bed,desk,table,bookshelf,dresser,window,door")
):
    """
    Runs Grounding DINO object detection on a room photo.
    Returns bounding boxes with labels.
    """
    label_list = [l.strip() for l in labels.split(",")]
    result = await detect_objects(image_url, label_list)
    return result

@app.post("/segment-room")
async def segment_room_endpoint(image_url: str = Form(...), bboxes: str = Form(...)):
    """
    Runs SAM 2/3 segmentation given bounding boxes from DINO.
    Returns pixel masks as polygons.
    """
    import json
    bbox_list = json.loads(bboxes)
    result = await segment_room(image_url, bbox_list)
    return result

@app.post("/estimate-scale")
async def estimate_scale_endpoint(image_url: str = Form(...)):
    """
    Attempts to estimate real-world scale from image metadata or known objects.
    Falls back to returning null (user must calibrate manually).
    """
    result = await estimate_scale_from_image(image_url)
    return result
```

### 1.3 — Floor Plan Parser (`python/services/floorplan_parser.py`)

```python
import cv2
import numpy as np
from PIL import Image
import io
import base64
import asyncio

async def parse_floorplan(image_bytes: bytes, content_type: str) -> dict:
    """
    Parses a floor plan image using OpenCV to extract wall polygon.
    
    Pipeline:
    1. Decode image (handle PDF → image conversion if needed)
    2. Grayscale + adaptive threshold
    3. Morphological ops to close wall gaps
    4. Find contours → select largest (= room boundary)
    5. Douglas-Peucker polygon approximation
    6. Return polygon points in pixel coords + image dimensions
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _parse_sync, image_bytes, content_type)

def _parse_sync(image_bytes: bytes, content_type: str) -> dict:
    # Handle PDF: convert first page to image
    if content_type == "application/pdf":
        try:
            from pdf2image import convert_from_bytes
            pages = convert_from_bytes(image_bytes, dpi=150, first_page=1, last_page=1)
            img_pil = pages[0]
            img_bytes_io = io.BytesIO()
            img_pil.save(img_bytes_io, format="PNG")
            image_bytes = img_bytes_io.getvalue()
        except Exception as e:
            return {"error": f"PDF conversion failed: {str(e)}", "points": [], "fallback": True}

    # Decode to OpenCV
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"error": "Could not decode image", "points": [], "fallback": True}

    img_h, img_w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Adaptive threshold for varied floor plan styles
    thresh = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=15,
        C=4
    )

    # Morphological close — fills gaps in wall lines
    kernel = np.ones((5, 5), np.uint8)
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=3)

    # Remove small noise
    opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel, iterations=1)

    # Find contours
    contours, _ = cv2.findContours(opened, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return {"error": "No room outline detected", "points": [], "fallback": True}

    # Filter contours by minimum area (at least 5% of image area)
    min_area = img_h * img_w * 0.05
    valid = [c for c in contours if cv2.contourArea(c) > min_area]
    if not valid:
        return {"error": "No large enough contour found", "points": [], "fallback": True}

    largest = max(valid, key=cv2.contourArea)

    # Douglas-Peucker approximation — aim for 4–12 vertices
    epsilon = 0.015 * cv2.arcLength(largest, True)
    approx = cv2.approxPolyDP(largest, epsilon, True)

    points = [[int(p[0][0]), int(p[0][1])] for p in approx]

    # Compute bounding box for scale hints
    x, y, w, h = cv2.boundingRect(largest)

    return {
        "points": points,
        "image_width": img_w,
        "image_height": img_h,
        "bounding_box": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
        "area_px": float(cv2.contourArea(largest)),
        "fallback": False
    }
```

### 1.4 — Object Recognition (`python/services/object_recognition.py`)

```python
import replicate
import os
import asyncio
import json

REPLICATE_TOKEN = os.getenv("REPLICATE_API_TOKEN")

# Grounding DINO model ID on Replicate (verify current version at replicate.com)
GROUNDING_DINO_MODEL = "adirik/grounding-dino:efd10a8ddc57511a7d96e314f3c36394b7ad2699ed2c7dd13c02d2ff43e4d81a"

# SAM 2 model ID (use until SAM 3 is available on Replicate)
SAM2_MODEL = "meta/sam-2:latest"

async def detect_objects(image_url: str, labels: list[str]) -> dict:
    """
    Runs Grounding DINO to detect furniture and room features.
    Falls back to returning empty list if Replicate is unavailable.
    """
    if not REPLICATE_TOKEN:
        return {"detections": [], "error": "REPLICATE_API_TOKEN not set — using manual mode"}

    loop = asyncio.get_event_loop()
    try:
        output = await loop.run_in_executor(
            None,
            lambda: replicate.run(
                GROUNDING_DINO_MODEL,
                input={
                    "image": image_url,
                    "query": " . ".join(labels),
                    "box_threshold": 0.30,
                    "text_threshold": 0.25,
                }
            )
        )
        # Parse output — Grounding DINO returns list of {label, box, score}
        detections = []
        if isinstance(output, list):
            for item in output:
                detections.append({
                    "label": item.get("label", "unknown"),
                    "score": round(float(item.get("score", 0)), 3),
                    "bbox": item.get("box", []),   # [x1, y1, x2, y2] normalized 0-1
                })
        return {"detections": detections, "error": None}
    except Exception as e:
        return {"detections": [], "error": str(e)}

async def segment_room(image_url: str, bboxes: list) -> dict:
    """
    Runs SAM 2/3 segmentation on detected bounding boxes.
    Returns polygon masks for each detected object.
    """
    if not REPLICATE_TOKEN:
        return {"masks": [], "error": "REPLICATE_API_TOKEN not set"}

    loop = asyncio.get_event_loop()
    try:
        output = await loop.run_in_executor(
            None,
            lambda: replicate.run(
                SAM2_MODEL,
                input={
                    "image": image_url,
                    "input_boxes": json.dumps(bboxes),
                }
            )
        )
        return {"masks": output if isinstance(output, list) else [], "error": None}
    except Exception as e:
        return {"masks": [], "error": str(e)}
```

### 1.5 — Scale Estimator (`python/services/scale_estimator.py`)

```python
async def estimate_scale_from_image(image_url: str) -> dict:
    """
    Attempts to estimate real-world scale. For MVP, always returns null
    and instructs the user to calibrate manually by clicking two known points.
    
    Future: Use exif data, standard door width (32in) as reference, or
    OCR to read dimension labels from architectural floor plans.
    """
    return {
        "scale_px_per_inch": None,
        "method": "manual_required",
        "message": "Click two points on the floor plan and enter the real-world distance to calibrate scale."
    }
```

### 1.6 — Express Route: Floor Plan Upload (`server/routes/rooms.js`)

```javascript
import express from 'express';
import multer from 'multer';
import FormData from 'form-data';
import axios from 'axios';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/rooms — create a new room
router.post('/', requireAuth, async (req, res) => {
  const { name, unit } = req.body;
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .insert({ user_id: req.user.id, name: name || 'My Room', unit: unit || 'inches' })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/rooms — list user rooms
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('*, placements(*)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/rooms/:id
router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('*, placements(*)')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error) return res.status(404).json({ error: 'Room not found' });
  res.json(data);
});

// PUT /api/rooms/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { name, width, depth, height, walls, scale_px_per_inch, unit } = req.body;
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .update({ name, width, depth, height, walls, scale_px_per_inch, unit, updated_at: new Date() })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/rooms/:id/upload-floorplan
router.post('/:id/upload-floorplan', requireAuth, upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    // 1. Upload to Supabase Storage
    const fileName = `${req.user.id}/${id}/floorplan-${Date.now()}.${file.originalname.split('.').pop()}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('floor-plans')
      .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage.from('floor-plans').getPublicUrl(fileName);

    // 2. Send to Python service for parsing
    const form = new FormData();
    form.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });

    const pythonRes = await axios.post(
      `${process.env.PYTHON_SERVICE_URL}/parse-floorplan`,
      form,
      { headers: form.getHeaders(), timeout: 30000 }
    );

    const parseResult = pythonRes.data;

    // 3. Save URL and parse result to room
    await supabaseAdmin
      .from('rooms')
      .update({ floor_plan_url: publicUrl, updated_at: new Date() })
      .eq('id', id)
      .eq('user_id', req.user.id);

    res.json({
      floor_plan_url: publicUrl,
      parse_result: parseResult
    });
  } catch (err) {
    console.error('Floor plan upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms/:id/calibrate
router.post('/:id/calibrate', requireAuth, async (req, res) => {
  const { p1, p2, real_world_inches } = req.body;
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const pixel_dist = Math.sqrt(dx * dx + dy * dy);
  const scale_px_per_inch = pixel_dist / real_world_inches;

  const { data, error } = await supabaseAdmin
    .from('rooms')
    .update({ scale_px_per_inch, updated_at: new Date() })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ scale_px_per_inch, room: data });
});

export default router;
```

### Layer 1 — Tests

Create `python/tests/test_floorplan_parser.py`:
```python
# Test with a known simple floor plan image
# Expected: returns 4-8 polygon points
# Test with corrupted image → returns fallback: True
# Test with PDF input → converts and parses
```

**✅ Layer 1 is complete when:** User uploads a floor plan, sees the detected wall polygon overlaid on the image in the browser, and can proceed to calibration.

---

## LAYER 2 — IMAGE OBJECT RECOGNITION (SAM 3 + Grounding DINO)

**Goal:** User uploads a room photo. The app detects furniture, windows, and doors using Grounding DINO, then segments them using SAM 2/3 via Replicate. Detected items are pre-populated in the 2D layout editor.

### 2.1 — Express Route (`server/routes/recognition.js`)

```javascript
import express from 'express';
import axios from 'axios';
import FormData from 'form-data';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const FURNITURE_LABELS = [
  'sofa', 'couch', 'chair', 'armchair', 'bed', 'desk', 'table', 'dining table',
  'coffee table', 'bookshelf', 'bookcase', 'dresser', 'nightstand', 'tv stand',
  'cabinet', 'window', 'door', 'rug', 'lamp'
];

// POST /api/recognition/room-photo/:room_id
router.post('/room-photo/:room_id', requireAuth, upload.single('file'), async (req, res) => {
  const { room_id } = req.params;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file provided' });

  try {
    // 1. Upload photo to Supabase
    const fileName = `${req.user.id}/${room_id}/photo-${Date.now()}.jpg`;
    await supabaseAdmin.storage.from('room-photos').upload(fileName, file.buffer, {
      contentType: file.mimetype, upsert: true
    });
    const { data: { publicUrl } } = supabaseAdmin.storage.from('room-photos').getPublicUrl(fileName);

    // 2. Detect objects via Grounding DINO
    const form = new FormData();
    form.append('image_url', publicUrl);
    form.append('labels', FURNITURE_LABELS.join(','));

    const detectionRes = await axios.post(
      `${process.env.PYTHON_SERVICE_URL}/detect-objects`,
      form,
      { headers: form.getHeaders(), timeout: 60000 }
    );

    const detections = detectionRes.data.detections || [];

    // 3. Segment detected objects with SAM 2/3
    let masks = [];
    if (detections.length > 0) {
      const segForm = new FormData();
      segForm.append('image_url', publicUrl);
      segForm.append('bboxes', JSON.stringify(detections.map(d => d.bbox)));

      try {
        const segRes = await axios.post(
          `${process.env.PYTHON_SERVICE_URL}/segment-room`,
          segForm,
          { headers: segForm.getHeaders(), timeout: 90000 }
        );
        masks = segRes.data.masks || [];
      } catch (segErr) {
        console.warn('Segmentation failed (non-fatal):', segErr.message);
      }
    }

    // 4. Combine detections + masks, save to room
    const detected_objects = detections.map((det, i) => ({
      ...det,
      mask: masks[i] || null,
      image_width: file.size,   // actual dims parsed from image in production
    }));

    await supabaseAdmin.from('rooms').update({
      room_photo_url: publicUrl,
      detected_objects,
      updated_at: new Date()
    }).eq('id', room_id).eq('user_id', req.user.id);

    res.json({
      room_photo_url: publicUrl,
      detections,
      masks_available: masks.length > 0
    });
  } catch (err) {
    console.error('Object recognition error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

### 2.2 — Room Photo Upload Component (`client/src/components/upload/RoomPhotoUpload.jsx`)

```jsx
import { useState, useRef } from 'react';
import api from '../../lib/api';

export default function RoomPhotoUpload({ roomId, onDetectionComplete }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState('');
  const [error, setError]         = useState('');
  const fileRef                   = useRef();

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setProgress('Uploading photo...');

    const form = new FormData();
    form.append('file', file);

    try {
      setProgress('Detecting furniture (Grounding DINO)...');
      const { data } = await api.post(`/api/recognition/room-photo/${roomId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setProgress(`Found ${data.detections.length} objects.`);
      onDetectionComplete?.(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {uploading ? progress : 'Upload Room Photo'}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      <p className="text-stone-400 text-xs mt-2">
        Upload a photo of your room — we'll detect furniture automatically
      </p>
    </div>
  );
}
```

**✅ Layer 2 is complete when:** User uploads a room photo, detections appear as labeled bounding boxes overlaid on the image, and the detected furniture items are listed in the catalog panel for the user to confirm and add to the layout.

---

## LAYERS 3 & 4 — HARDCODED DEFAULTS & RULES

### `server/config/defaults.js`

```javascript
// All hardcoded constants for Vision Studio.
// Edit this file to change global defaults — never scatter magic numbers.

export const DEFAULTS = {
  // Room geometry
  roomHeightInches:    96,     // standard 8ft ceiling
  wallThicknessInches: 4,      // standard residential wall
  minClearanceInches:  24,     // minimum walkway between furniture
  doorWidthInches:     32,     // standard interior door
  windowHeightInches:  48,     // standard window height from floor

  // Canvas / editor
  gridSnapInches:      6,      // snap grid resolution
  defaultUnit:         'inches',
  defaultScale:        4.0,    // px per inch if no calibration done

  // Furniture colors by category
  colors: {
    sofa:          '#c8a97e',
    loveseat:      '#d4b48c',
    bed:           '#a8c4d4',
    desk:          '#d4c87a',
    bookshelf:     '#8c6444',
    dining_table:  '#b89870',
    coffee_table:  '#c9a96e',
    dresser:       '#b8a090',
    nightstand:    '#c4b0a0',
    armchair:      '#d0b888',
    tv_stand:      '#909090',
    cabinet:       '#a09080',
    default:       '#cccccc',
  },

  // Validation rules
  validation: {
    allowOverlap:    false,
    allowOutOfBounds: false,
    snapToGrid:      true,
    warnNarrowPath:  true,   // warn if clearance < minClearanceInches
  },

  // LLM defaults
  llm: {
    defaultModel:    'gpt-4o',
    fallbackModel:   'gpt-4o',
    maxTokens:       2048,
    temperature:     0.3,    // low temp for layout tasks (deterministic)
  },

  // Export
  export: {
    schemaVersion: '1.0',
    defaultFormat: 'json',
  }
};

// Furniture category → standard footprint ranges (inches)
// Used to validate user-entered dimensions
export const FURNITURE_BOUNDS = {
  sofa:         { minW: 60, maxW: 120, minD: 30, maxD: 50 },
  loveseat:     { minW: 48, maxW: 72,  minD: 28, maxD: 42 },
  bed_twin:     { minW: 36, maxW: 42,  minD: 72, maxD: 80 },
  bed_full:     { minW: 52, maxW: 58,  minD: 72, maxD: 80 },
  bed_queen:    { minW: 58, maxW: 64,  minD: 78, maxD: 84 },
  bed_king:     { minW: 74, maxW: 80,  minD: 78, maxD: 84 },
  desk:         { minW: 36, maxW: 72,  minD: 20, maxD: 36 },
  dining_table: { minW: 36, maxW: 96,  minD: 30, maxD: 48 },
  bookshelf:    { minW: 24, maxW: 48,  minD:  8, maxD: 16 },
  dresser:      { minW: 30, maxW: 60,  minD: 16, maxD: 24 },
};
```

### `client/src/utils/constants.js`

```javascript
// Mirror of server defaults for client-side use
export const GRID_SNAP_INCHES   = 6;
export const MIN_CLEARANCE_IN   = 24;
export const DEFAULT_HEIGHT_IN  = 96;
export const DEFAULT_SCALE      = 4.0;

export const CATEGORY_COLORS = {
  sofa: '#c8a97e', bed: '#a8c4d4', desk: '#d4c87a',
  bookshelf: '#8c6444', dining_table: '#b89870',
  coffee_table: '#c9a96e', dresser: '#b8a090',
  armchair: '#d0b888', tv_stand: '#909090', default: '#cccccc'
};
```

---

## LAYER 5 — 3D GENERATION (Meshy + Offline Blender Pipeline)

**Goal:** Generate high-quality 3D GLB furniture models using Meshy AI. This is an OFFLINE step — models are generated once per furniture category and stored in Supabase Storage. The user does not wait for 3D generation at runtime.

### 5.1 — Meshy Service (`server/services/meshy.js`)

```javascript
import axios from 'axios';

const MESHY_BASE = 'https://api.meshy.ai/openapi/v1';
const headers = () => ({ Authorization: `Bearer ${process.env.MESHY_API_KEY}` });

/**
 * Submit an image-to-3D task.
 * image_url: publicly accessible URL of the furniture image
 * Returns task ID.
 */
export async function submitImageTo3D(image_url, options = {}) {
  if (!process.env.MESHY_API_KEY) {
    console.warn('MESHY_API_KEY not set — skipping 3D generation');
    return null;
  }
  const { data } = await axios.post(`${MESHY_BASE}/image-to-3d`, {
    image_url,
    enable_pbr: true,
    ai_model: 'meshy-4',
    topology: 'quad',
    target_polycount: 8000,
    ...options
  }, { headers: headers() });
  return data.result;   // task ID
}

/**
 * Poll Meshy task until complete. Returns model URLs.
 * Timeout: 3 minutes.
 */
export async function pollMeshyTask(taskId, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 5000));
    const { data } = await axios.get(`${MESHY_BASE}/image-to-3d/${taskId}`, { headers: headers() });
    if (data.status === 'SUCCEEDED') {
      return {
        glb_url:       data.model_urls?.glb,
        fbx_url:       data.model_urls?.fbx,
        thumbnail_url: data.thumbnail_url,
      };
    }
    if (data.status === 'FAILED') throw new Error(`Meshy task ${taskId} failed`);
  }
  throw new Error('Meshy task timed out');
}

/**
 * Full pipeline: submit + poll + return GLB URL.
 */
export async function generateFurnitureModel(image_url) {
  const taskId = await submitImageTo3D(image_url);
  if (!taskId) return null;
  return await pollMeshyTask(taskId);
}
```

### 5.2 — Offline Model Generation Script (`server/scripts/generateModels.js`)

```javascript
/**
 * Run this script ONCE to generate 3D models for each furniture category.
 * Usage: node server/scripts/generateModels.js
 *
 * This is NOT run per user session — it generates prefab models offline.
 */
import { generateFurnitureModel } from '../services/meshy.js';
import { supabaseAdmin } from '../services/supabase.js';

// Reference images for each category (use Wikimedia Commons or Unsplash CC0)
const CATEGORY_REFERENCE_IMAGES = {
  sofa:          'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Sofa.jpg/640px-Sofa.jpg',
  bed:           'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Bed.jpg/640px-Bed.jpg',
  desk:          'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Desk.jpg/640px-Desk.jpg',
  bookshelf:     'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Bookcase.jpg/640px-Bookcase.jpg',
  dining_table:  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/DiningTable.jpg/640px-DiningTable.jpg',
  chair:         'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Chair.jpg/640px-Chair.jpg',
  dresser:       'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Dresser.jpg/640px-Dresser.jpg',
  coffee_table:  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/CoffeeTable.jpg/640px-CoffeeTable.jpg',
  nightstand:    'https://upload.wikimedia.org/wikipedia/commons/thumb/n/n5/Nightstand.jpg/640px-Nightstand.jpg',
  armchair:      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Armchair.jpg/640px-Armchair.jpg',
};

async function main() {
  console.log('Starting offline furniture model generation via Meshy...');
  for (const [category, imageUrl] of Object.entries(CATEGORY_REFERENCE_IMAGES)) {
    console.log(`\nGenerating ${category}...`);
    try {
      const result = await generateFurnitureModel(imageUrl);
      if (!result) { console.log(`  Skipped (no Meshy key)`); continue; }

      // Upload GLB to Supabase Storage
      const glbRes = await fetch(result.glb_url);
      const glbBuffer = Buffer.from(await glbRes.arrayBuffer());
      const path = `prefabs/${category}.glb`;
      await supabaseAdmin.storage.from('models').upload(path, glbBuffer, {
        contentType: 'model/gltf-binary', upsert: true
      });
      const { data: { publicUrl } } = supabaseAdmin.storage.from('models').getPublicUrl(path);

      // Save URL in furniture_catalog table
      await supabaseAdmin.from('furniture_catalog')
        .update({ model_url: publicUrl })
        .eq('category', category);

      console.log(`  ✅ ${category} → ${publicUrl}`);
    } catch (err) {
      console.error(`  ❌ ${category} failed: ${err.message}`);
    }
  }
  console.log('\nDone. GLB models stored in Supabase Storage → models/prefabs/');
}

main();
```

**✅ Layer 5 is complete when:** `node server/scripts/generateModels.js` completes and GLB URLs are stored in the furniture_catalog table. Unity can load them by category name.

---

## LAYER 6 — ROOM IMAGE / OBJECT RENDERING (2D Editor with Detection Overlay)

**Goal:** The Konva 2D editor overlays detected bounding boxes from Grounding DINO on the room photo, lets the user confirm or dismiss each one, and adds confirmed items to the layout.

### 6.1 — Konva Canvas with Detection Overlay (`client/src/components/canvas/RoomCanvas.jsx`)

```jsx
import { Stage, Layer, Image as KonvaImage, Line, Rect, Text, Group } from 'react-konva';
import useImage from 'use-image';
import { useLayoutStore } from '../../store/layoutStore';
import FurnitureItem from './FurnitureItem';
import WallOutline from './WallOutline';
import GridOverlay from './GridOverlay';
import { inchesToPx } from '../../utils/scale';
import { CATEGORY_COLORS } from '../../utils/constants';

export default function RoomCanvas({ width = 900, height = 700 }) {
  const {
    room, furniture, selectedId, detections,
    selectFurniture, updateFurniture, clearSelection,
    confirmDetection, dismissDetection
  } = useLayoutStore();

  const [floorPlanImg] = useImage(room?.floor_plan_url || room?.room_photo_url || '');
  const scale = room?.scale_px_per_inch || 4.0;

  return (
    <Stage
      width={width}
      height={height}
      onClick={(e) => { if (e.target === e.target.getStage()) clearSelection(); }}
      style={{ background: '#f5f4f0', border: '1px solid #ddd', borderRadius: 8 }}
    >
      {/* Layer 0: Background image */}
      <Layer>
        {floorPlanImg && (
          <KonvaImage
            image={floorPlanImg}
            x={0} y={0}
            width={width} height={height}
            opacity={0.4}
          />
        )}
      </Layer>

      {/* Layer 1: Grid */}
      <Layer>
        <GridOverlay width={width} height={height} scale={scale} />
      </Layer>

      {/* Layer 2: Room walls */}
      <Layer>
        {room?.walls && <WallOutline walls={room.walls} scale={scale} />}
      </Layer>

      {/* Layer 3: AI detection overlay (pending confirmations) */}
      <Layer>
        {(detections || []).filter(d => d.status === 'pending').map((det, i) => {
          const [x1, y1, x2, y2] = det.bbox.map((v, idx) =>
            idx % 2 === 0 ? v * width : v * height   // denormalize 0-1 coords
          );
          return (
            <Group key={i}>
              <Rect
                x={x1} y={y1} width={x2 - x1} height={y2 - y1}
                stroke="#3b82f6" strokeWidth={2} dash={[6, 3]}
                fill="rgba(59,130,246,0.08)"
              />
              <Text
                x={x1 + 4} y={y1 + 4}
                text={`${det.label} (${Math.round(det.score * 100)}%)`}
                fontSize={12} fill="#1e40af"
              />
            </Group>
          );
        })}
      </Layer>

      {/* Layer 4: Placed furniture */}
      <Layer>
        {furniture.map(item => (
          <FurnitureItem
            key={item.id}
            item={item}
            scale={scale}
            isSelected={item.id === selectedId}
            onSelect={() => selectFurniture(item.id)}
            onChange={(updated) => updateFurniture(item.id, updated)}
          />
        ))}
      </Layer>
    </Stage>
  );
}
```

---

## LAYER 7 — EDITOR / INTERACTION LAYER (SAM 3 MASK EDITOR)

**Goal:** User can click any object in the room photo and SAM 3 generates a mask. Masked regions can be labeled, moved, or removed. This is the interactive editing layer on top of the AI detections.

### 7.1 — Mask Editor Component (`client/src/components/editor/MaskEditor.jsx`)

```jsx
import { useState } from 'react';
import api from '../../lib/api';
import { useLayoutStore } from '../../store/layoutStore';

export default function MaskEditor({ roomId, imageUrl, imageWidth, imageHeight }) {
  const { addFurniture } = useLayoutStore();
  const [clicking, setClicking]   = useState(false);
  const [masks, setMasks]         = useState([]);
  const [error, setError]         = useState('');

  // User clicks on image → send click coords to SAM 3 for mask generation
  const handleImageClick = async (e) => {
    const rect = e.target.getBoundingClientRect();
    const xNorm = (e.clientX - rect.left) / rect.width;
    const yNorm = (e.clientY - rect.top) / rect.height;

    setClicking(true);
    setError('');
    try {
      const { data } = await api.post('/api/recognition/click-segment', {
        room_id: roomId,
        image_url: imageUrl,
        click_x: xNorm,
        click_y: yNorm,
      });
      if (data.mask) {
        setMasks(prev => [...prev, { ...data.mask, id: Date.now(), label: 'furniture' }]);
      }
    } catch (err) {
      setError('Segmentation unavailable — use manual placement');
    } finally {
      setClicking(false);
    }
  };

  const confirmMask = (mask, label) => {
    // Convert mask bbox to furniture placement
    addFurniture({
      name: label,
      category: label.toLowerCase().replace(' ', '_'),
      width: Math.round((mask.bbox[2] - mask.bbox[0]) * imageWidth / 12),  // estimate inches
      depth: Math.round((mask.bbox[3] - mask.bbox[1]) * imageHeight / 12),
      height: 36,
      color: '#cccccc',
      custom: true,
    });
    setMasks(prev => prev.filter(m => m.id !== mask.id));
  };

  return (
    <div className="relative">
      <img
        src={imageUrl}
        alt="Room"
        className={`w-full rounded-lg ${clicking ? 'cursor-wait' : 'cursor-crosshair'}`}
        onClick={handleImageClick}
      />
      {clicking && (
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center rounded-lg">
          <p className="text-white font-medium">Segmenting...</p>
        </div>
      )}
      {error && <p className="text-amber-600 text-sm mt-1">{error}</p>}

      {/* Pending mask confirmations */}
      {masks.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium text-stone-600">Confirm detected objects:</p>
          {masks.map(mask => (
            <div key={mask.id} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
              <input
                className="border rounded px-2 py-1 text-sm"
                value={mask.label}
                onChange={e => setMasks(prev => prev.map(m => m.id === mask.id ? { ...m, label: e.target.value } : m))}
              />
              <button onClick={() => confirmMask(mask, mask.label)}
                className="bg-green-600 text-white text-sm px-3 py-1 rounded hover:bg-green-700">
                Add to Layout
              </button>
              <button onClick={() => setMasks(prev => prev.filter(m => m.id !== mask.id))}
                className="text-stone-400 hover:text-stone-600 text-sm">
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 7.2 — Click-Segment Endpoint (`server/routes/recognition.js` — add this route)

```javascript
// POST /api/recognition/click-segment
router.post('/click-segment', requireAuth, async (req, res) => {
  const { room_id, image_url, click_x, click_y } = req.body;

  try {
    const form = new FormData();
    form.append('image_url', image_url);
    form.append('bboxes', JSON.stringify([[click_x - 0.05, click_y - 0.05, click_x + 0.05, click_y + 0.05]]));

    const segRes = await axios.post(
      `${process.env.PYTHON_SERVICE_URL}/segment-room`,
      form,
      { headers: form.getHeaders(), timeout: 30000 }
    );

    const mask = segRes.data.masks?.[0] || null;
    res.json({ mask });
  } catch (err) {
    res.status(500).json({ mask: null, error: err.message });
  }
});
```

**✅ Layer 7 is complete when:** User can click any object in the room photo and see a segmentation mask generated around it, with an option to label it and add it to the 2D layout.

---

## LAYER 8 — FURNITURE RECOMMENDATION DATABASE

**Goal:** IKEA and Ashley Furniture catalogs are seeded into the database. Users can browse, search, and filter by provider. The catalog drives all furniture placements.

### 8.1 — Seed Script (`server/scripts/seedFurniture.js`)

```javascript
/**
 * Seeds the furniture_catalog table with real IKEA + Ashley data.
 * Sources:
 *   - IKEA: Hugging Face dataset 'tsan/ikea-us-commercetxt' (30,511 products)
 *     OR manual curated list below (fallback)
 *   - Ashley: manually curated from ashleyfurniture.com
 *
 * Usage: node server/scripts/seedFurniture.js
 */

import { supabaseAdmin } from '../services/supabase.js';

const IKEA_PRODUCTS = [
  // SOFAS
  { category: 'sofa', name: 'SÖDERHAMN 3-seat sofa', provider: 'ikea', provider_id: 's49302521', width: 93, depth: 39, height: 33, price_usd: 699, url: 'https://www.ikea.com/us/en/p/soederhamn-sofa-finnsta-white-s49302521/', image_url: 'https://www.ikea.com/us/en/images/products/soederhamn-sofa-finnsta-white__0926455_pe783179_s5.jpg' },
  { category: 'sofa', name: 'KIVIK 3-seat sofa', provider: 'ikea', provider_id: 's49282816', width: 90, depth: 37, height: 32, price_usd: 799, url: 'https://www.ikea.com/us/en/p/kivik-sofa-tibbleby-beige-grey-s49282816/', image_url: '' },
  { category: 'sofa', name: 'EKTORP 3-seat sofa', provider: 'ikea', provider_id: 's89282816', width: 88, depth: 36, height: 34, price_usd: 549, url: 'https://www.ikea.com/us/en/p/ektorp-sofa-vittaryd-white-s29282816/', image_url: '' },
  // BEDS
  { category: 'bed', name: 'MALM Bed Frame (Queen)', provider: 'ikea', provider_id: 's39280887', width: 63, depth: 83, height: 15, price_usd: 329, url: 'https://www.ikea.com/us/en/p/malm-bed-frame-high-white-s39280887/', image_url: '' },
  { category: 'bed', name: 'HEMNES Bed Frame (Queen)', provider: 'ikea', provider_id: 's19180534', width: 64, depth: 85, height: 20, price_usd: 449, url: 'https://www.ikea.com/us/en/p/hemnes-bed-frame-white-stain-s19180534/', image_url: '' },
  { category: 'bed', name: 'BRIMNES Bed Frame (Full)', provider: 'ikea', provider_id: 's39157412', width: 57, depth: 82, height: 17, price_usd: 299, url: 'https://www.ikea.com/us/en/p/brimnes-bed-frame-with-storage-white-s39157412/', image_url: '' },
  // DESKS
  { category: 'desk', name: 'LINNMON/ADILS Desk', provider: 'ikea', provider_id: 's19157498', width: 59, depth: 24, height: 29, price_usd: 74, url: 'https://www.ikea.com/us/en/p/linnmon-adils-table-white-s19157498/', image_url: '' },
  { category: 'desk', name: 'MICKE Desk', provider: 'ikea', provider_id: 's80213074', width: 56, depth: 20, height: 30, price_usd: 129, url: 'https://www.ikea.com/us/en/p/micke-desk-white-s80213074/', image_url: '' },
  { category: 'desk', name: 'ALEX Desk', provider: 'ikea', provider_id: 's00473546', width: 54, depth: 24, height: 30, price_usd: 269, url: 'https://www.ikea.com/us/en/p/alex-desk-white-s00473546/', image_url: '' },
  // BOOKSHELVES
  { category: 'bookshelf', name: 'BILLY Bookcase (standard)', provider: 'ikea', provider_id: 's0263832', width: 31.5, depth: 11, height: 79.5, price_usd: 79, url: 'https://www.ikea.com/us/en/p/billy-bookcase-white-0263832/', image_url: '' },
  { category: 'bookshelf', name: 'KALLAX Shelf Unit (4x4)', provider: 'ikea', provider_id: 's10275971', width: 57.5, depth: 15.5, height: 57.5, price_usd: 189, url: 'https://www.ikea.com/us/en/p/kallax-shelf-unit-white-s10275971/', image_url: '' },
  // DINING TABLES
  { category: 'dining_table', name: 'EKEDALEN Dining Table', provider: 'ikea', provider_id: 's29041169', width: 70, depth: 35, height: 29, price_usd: 449, url: 'https://www.ikea.com/us/en/p/ekedalen-extendable-table-white-s29041169/', image_url: '' },
  { category: 'dining_table', name: 'LISABO Dining Table', provider: 'ikea', provider_id: 's09257608', width: 55, depth: 31, height: 29, price_usd: 249, url: 'https://www.ikea.com/us/en/p/lisabo-table-ash-veneer-s09257608/', image_url: '' },
  // DRESSERS
  { category: 'dresser', name: 'MALM 6-drawer dresser', provider: 'ikea', provider_id: 's10178608', width: 31.5, depth: 18.5, height: 48.5, price_usd: 229, url: 'https://www.ikea.com/us/en/p/malm-6-drawer-dresser-white-s10178608/', image_url: '' },
  { category: 'dresser', name: 'HEMNES 8-drawer dresser', provider: 'ikea', provider_id: 's10176325', width: 63, depth: 19.5, height: 59.5, price_usd: 349, url: 'https://www.ikea.com/us/en/p/hemnes-8-drawer-dresser-white-stain-s10176325/', image_url: '' },
  // COFFEE TABLES
  { category: 'coffee_table', name: 'HEMNES Coffee table', provider: 'ikea', provider_id: 's80176212', width: 45.5, depth: 23.5, height: 18.5, price_usd: 199, url: 'https://www.ikea.com/us/en/p/hemnes-coffee-table-white-stain-s80176212/', image_url: '' },
  { category: 'coffee_table', name: 'LACK Coffee table', provider: 'ikea', provider_id: 's30173961', width: 35.5, depth: 21.5, height: 17.75, price_usd: 29, url: 'https://www.ikea.com/us/en/p/lack-coffee-table-white-s30173961/', image_url: '' },
  // NIGHTSTANDS
  { category: 'nightstand', name: 'MALM Nightstand', provider: 'ikea', provider_id: 's90178483', width: 18.5, depth: 15.75, height: 22, price_usd: 79, url: 'https://www.ikea.com/us/en/p/malm-nightstand-white-s90178483/', image_url: '' },
  { category: 'nightstand', name: 'HEMNES Nightstand', provider: 'ikea', provider_id: 's30176323', width: 18.5, depth: 13.5, height: 27.5, price_usd: 119, url: 'https://www.ikea.com/us/en/p/hemnes-nightstand-white-stain-s30176323/', image_url: '' },
  // ARMCHAIRS
  { category: 'armchair', name: 'STRANDMON Wing Chair', provider: 'ikea', provider_id: 's29281971', width: 33, depth: 37, height: 43.5, price_usd: 349, url: 'https://www.ikea.com/us/en/p/strandmon-wing-chair-skiftebo-yellow-s29281971/', image_url: '' },
  { category: 'armchair', name: 'POÄNG Armchair', provider: 'ikea', provider_id: 's29281789', width: 26.5, depth: 32, height: 39.5, price_usd: 119, url: 'https://www.ikea.com/us/en/p/poaeng-armchair-birch-veneer-knisa-light-beige-s29281789/', image_url: '' },
  // TV STANDS
  { category: 'tv_stand', name: 'BESTA TV Unit', provider: 'ikea', provider_id: 's99298433', width: 70.5, depth: 16.5, height: 15, price_usd: 319, url: 'https://www.ikea.com/us/en/p/besta-tv-unit-white-s99298433/', image_url: '' },
];

const ASHLEY_PRODUCTS = [
  // SOFAS
  { category: 'sofa', name: 'Darcy Sofa', provider: 'ashley', provider_id: 'ash-7500138', width: 87, depth: 38, height: 38, price_usd: 550, url: 'https://www.ashleyfurniture.com/p/darcy-sofa/7500138.html', image_url: '' },
  { category: 'sofa', name: 'Benchcraft Alenya Sofa', provider: 'ashley', provider_id: 'ash-1660038', width: 89, depth: 37, height: 39, price_usd: 699, url: 'https://www.ashleyfurniture.com/p/alenya-sofa/1660038.html', image_url: '' },
  // BEDS
  { category: 'bed', name: 'Alisdair Queen Bed', provider: 'ashley', provider_id: 'ash-b376-81', width: 65, depth: 86, height: 58, price_usd: 399, url: 'https://www.ashleyfurniture.com/p/alisdair-queen-panel-bed/B37681.html', image_url: '' },
  // DINING TABLES
  { category: 'dining_table', name: 'Brookhaven Dining Table', provider: 'ashley', provider_id: 'ash-d319-25', width: 60, depth: 38, height: 30, price_usd: 449, url: 'https://www.ashleyfurniture.com/p/brookhaven-dining-table/D31925.html', image_url: '' },
  // DRESSERS
  { category: 'dresser', name: 'Maribel Dresser', provider: 'ashley', provider_id: 'ash-b138-31', width: 60, depth: 15.5, height: 36, price_usd: 499, url: 'https://www.ashleyfurniture.com/p/maribel-dresser/B13831.html', image_url: '' },
];

async function seed() {
  console.log('Seeding furniture catalog...');
  const all = [...IKEA_PRODUCTS, ...ASHLEY_PRODUCTS];

  // Batch insert in chunks of 50
  for (let i = 0; i < all.length; i += 50) {
    const chunk = all.slice(i, i + 50);
    const { error } = await supabaseAdmin.from('furniture_catalog').upsert(chunk, { onConflict: 'provider,provider_id' });
    if (error) console.error('Seed error:', error.message);
    else console.log(`  Inserted ${chunk.length} items`);
  }
  console.log(`\n✅ Seeded ${all.length} furniture items.`);
}

seed();
```

### 8.2 — Furniture API Routes (`server/routes/furniture.js`)

```javascript
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase.js';

const router = express.Router();

// GET /api/furniture/catalog?category=sofa&provider=ikea&q=billy
router.get('/catalog', async (req, res) => {
  const { category, provider, q, limit = 50, offset = 0 } = req.query;
  let query = supabaseAdmin.from('furniture_catalog').select('*').eq('available', true);
  if (category) query = query.eq('category', category);
  if (provider) query = query.eq('provider', provider);
  if (q)        query = query.ilike('name', `%${q}%`);
  query = query.range(Number(offset), Number(offset) + Number(limit) - 1).order('name');

  const { data, error, count } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json({ items: data, total: count });
});

// GET /api/furniture/catalog/:id
router.get('/catalog/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('furniture_catalog').select('*').eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// GET /api/furniture/categories
router.get('/categories', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('furniture_catalog')
    .select('category')
    .eq('available', true);
  if (error) return res.status(400).json({ error: error.message });
  const unique = [...new Set(data.map(d => d.category))].sort();
  res.json(unique);
});

// POST /api/furniture/placements — add furniture to a room
router.post('/placements', requireAuth, async (req, res) => {
  const { room_id, catalog_id, name, category, provider, provider_id,
          width, depth, height, x_inches, y_inches, rotation, color, custom } = req.body;

  const { data, error } = await supabaseAdmin.from('placements').insert({
    room_id, catalog_id, name, category, provider, provider_id,
    width, depth, height,
    x_inches: x_inches || 0,
    y_inches: y_inches || 0,
    rotation: rotation || 0,
    color: color || '#d4a27a',
    custom: custom || false,
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// PUT /api/furniture/placements/:id
router.put('/placements/:id', requireAuth, async (req, res) => {
  const allowed = ['x_inches', 'y_inches', 'rotation', 'width', 'depth', 'height', 'color', 'name'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  updates.updated_at = new Date();

  const { data, error } = await supabaseAdmin.from('placements')
    .update(updates)
    .eq('id', req.params.id)
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// DELETE /api/furniture/placements/:id
router.delete('/placements/:id', requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin.from('placements').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

export default router;
```

**✅ Layer 8 is complete when:** `node server/scripts/seedFurniture.js` runs successfully, furniture appears in the catalog panel, and drag-to-canvas works with IKEA items.

---

## LAYER 9 — CHATBOT (Multi-LLM Wrapper)

**Goal:** A sidebar chatbot that understands the user's room, suggests furniture, and can execute layout commands using structured LLM function calling. Supports GPT-4o, Claude, and Gemini — switchable per task.

### 9.1 — LLM Router (`server/services/llmRouter.js`)

```javascript
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const openai    = process.env.OPENAI_API_KEY    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const gemini    = process.env.GEMINI_API_KEY    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

/**
 * Unified chat call.
 * model: 'gpt-4o' | 'claude-opus-4-6' | 'gemini-2.5-pro'
 * messages: [{role, content}]
 * tools: array of function definitions
 * Returns: { text, tool_calls }
 */
export async function chat({ messages, systemPrompt, tools = [], model = 'gpt-4o' }) {
  // Auto-select based on availability if preferred model key is missing
  if (model.startsWith('gpt')    && !openai)    model = anthropic ? 'claude-opus-4-6' : 'gemini-2.5-pro';
  if (model.startsWith('claude') && !anthropic) model = openai ? 'gpt-4o' : 'gemini-2.5-pro';
  if (model.startsWith('gemini') && !gemini)    model = openai ? 'gpt-4o' : 'claude-opus-4-6';

  if (!openai && !anthropic && !gemini) {
    throw new Error('No LLM API keys configured. Set at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY in server/.env');
  }

  try {
    if (model.startsWith('gpt') && openai) {
      const res = await openai.chat.completions.create({
        model,
        temperature: 0.3,
        max_tokens: 2048,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        ...(tools.length > 0 ? {
          tools: tools.map(t => ({ type: 'function', function: t })),
          tool_choice: 'auto',
        } : {})
      });
      const msg = res.choices[0].message;
      return {
        text:       msg.content || '',
        tool_calls: msg.tool_calls || [],
        model_used: model,
      };
    }

    if (model.startsWith('claude') && anthropic) {
      const res = await anthropic.messages.create({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages,
        ...(tools.length > 0 ? {
          tools: tools.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters,
          }))
        } : {})
      });
      const textBlock     = res.content.find(c => c.type === 'text');
      const toolUseBlocks = res.content.filter(c => c.type === 'tool_use');
      return {
        text:       textBlock?.text || '',
        tool_calls: toolUseBlocks.map(b => ({ function: { name: b.name, arguments: JSON.stringify(b.input) }, id: b.id })),
        model_used: model,
      };
    }

    if (model.startsWith('gemini') && gemini) {
      const genModel = gemini.getGenerativeModel({ model, generationConfig: { temperature: 0.3, maxOutputTokens: 2048 } });
      const prompt   = [systemPrompt, ...messages.map(m => `${m.role}: ${m.content}`)].join('\n\n');
      const result   = await genModel.generateContent(prompt);
      return { text: result.response.text(), tool_calls: [], model_used: model };
    }
  } catch (err) {
    // Fallback: try next available model
    console.error(`LLM ${model} failed: ${err.message}. Attempting fallback.`);
    const fallback = openai ? 'gpt-4o' : anthropic ? 'claude-opus-4-6' : null;
    if (fallback && fallback !== model) return chat({ messages, systemPrompt, tools, model: fallback });
    throw err;
  }
}
```

### 9.2 — Layout Functions for Chatbot (`server/routes/chat.js`)

```javascript
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase.js';
import { chat } from '../services/llmRouter.js';

const router = express.Router();

const LAYOUT_FUNCTIONS = [
  {
    name: 'move_furniture',
    description: 'Move a furniture item to a new (x, y) position in the room (in inches from top-left corner)',
    parameters: {
      type: 'object',
      properties: {
        furniture_name: { type: 'string', description: 'Name of the furniture item to move' },
        x_inches: { type: 'number' },
        y_inches: { type: 'number' },
      },
      required: ['furniture_name', 'x_inches', 'y_inches']
    }
  },
  {
    name: 'rotate_furniture',
    description: 'Rotate a furniture item to a specific angle',
    parameters: {
      type: 'object',
      properties: {
        furniture_name: { type: 'string' },
        rotation: { type: 'number', enum: [0, 90, 180, 270] },
      },
      required: ['furniture_name', 'rotation']
    }
  },
  {
    name: 'suggest_furniture',
    description: 'Suggest furniture items from the catalog that fit in available space',
    parameters: {
      type: 'object',
      properties: {
        category:          { type: 'string' },
        max_width_inches:  { type: 'number' },
        max_depth_inches:  { type: 'number' },
        provider:          { type: 'string', enum: ['ikea', 'ashley', 'any'] },
        style_hint:        { type: 'string' },
      },
      required: ['category']
    }
  },
  {
    name: 'add_furniture',
    description: 'Add a specific furniture item from the catalog to the room',
    parameters: {
      type: 'object',
      properties: {
        catalog_item_name: { type: 'string' },
        x_inches:          { type: 'number' },
        y_inches:          { type: 'number' },
      },
      required: ['catalog_item_name']
    }
  },
  {
    name: 'remove_furniture',
    description: 'Remove a furniture item from the room',
    parameters: {
      type: 'object',
      properties: { furniture_name: { type: 'string' } },
      required: ['furniture_name']
    }
  },
  {
    name: 'validate_layout',
    description: 'Check all furniture placements for fit and collision issues',
    parameters: { type: 'object', properties: {} }
  }
];

async function executeFunction(fnName, args, roomId, placements, room) {
  switch (fnName) {
    case 'move_furniture': {
      const p = placements.find(p => p.name?.toLowerCase().includes(args.furniture_name.toLowerCase()));
      if (!p) return { success: false, message: `Furniture "${args.furniture_name}" not found` };
      await supabaseAdmin.from('placements').update({ x_inches: args.x_inches, y_inches: args.y_inches }).eq('id', p.id);
      return { success: true, message: `Moved ${p.name} to (${args.x_inches}", ${args.y_inches}")` };
    }
    case 'rotate_furniture': {
      const p = placements.find(p => p.name?.toLowerCase().includes(args.furniture_name.toLowerCase()));
      if (!p) return { success: false, message: `Furniture "${args.furniture_name}" not found` };
      await supabaseAdmin.from('placements').update({ rotation: args.rotation }).eq('id', p.id);
      return { success: true, message: `Rotated ${p.name} to ${args.rotation}°` };
    }
    case 'suggest_furniture': {
      let q = supabaseAdmin.from('furniture_catalog').select('*');
      if (args.category)        q = q.eq('category', args.category);
      if (args.provider && args.provider !== 'any') q = q.eq('provider', args.provider);
      if (args.max_width_inches) q = q.lte('width', args.max_width_inches);
      if (args.max_depth_inches) q = q.lte('depth', args.max_depth_inches);
      const { data } = await q.limit(5);
      return { success: true, suggestions: data };
    }
    case 'validate_layout': {
      // Simple server-side AABB check
      const errors = [];
      const scale = room.scale_px_per_inch || 4;
      for (let i = 0; i < placements.length; i++) {
        for (let j = i + 1; j < placements.length; j++) {
          const a = placements[i], b = placements[j];
          const ax2 = a.x_inches + a.width, ay2 = a.y_inches + a.depth;
          const bx2 = b.x_inches + b.width, by2 = b.y_inches + b.depth;
          if (!(ax2 <= b.x_inches || bx2 <= a.x_inches || ay2 <= b.y_inches || by2 <= a.y_inches)) {
            errors.push(`${a.name} overlaps with ${b.name}`);
          }
        }
      }
      return { success: true, valid: errors.length === 0, errors };
    }
    default:
      return { success: false, message: `Unknown function: ${fnName}` };
  }
}

// POST /api/chat/message
router.post('/message', requireAuth, async (req, res) => {
  const { room_id, message, model } = req.body;

  const [roomRes, placementsRes, historyRes] = await Promise.all([
    supabaseAdmin.from('rooms').select('*').eq('id', room_id).single(),
    supabaseAdmin.from('placements').select('*').eq('room_id', room_id),
    supabaseAdmin.from('chat_messages').select('*').eq('room_id', room_id).order('created_at').limit(20),
  ]);

  const room       = roomRes.data;
  const placements = placementsRes.data || [];
  const history    = historyRes.data || [];

  const systemPrompt = `You are an expert interior design assistant for Vision Studio.
The user is designing a room with the following specifications:
- Room: ${room?.name || 'Unnamed'} — ${room?.width}" wide × ${room?.depth}" deep × ${room?.height || 96}" tall
- Unit system: ${room?.unit || 'inches'}
- Current furniture (${placements.length} items):
${placements.map(p => `  • ${p.name} (${p.category}) — ${p.width}"W × ${p.depth}"D × ${p.height}"H — at position (${p.x_inches}", ${p.y_inches}"), rotation ${p.rotation}°`).join('\n')}

When suggesting positions, ensure furniture stays within room boundaries and doesn't overlap.
Keep at least 24 inches of walkway clearance in main pathways.
Be helpful, specific, and use real product names from IKEA or Ashley Furniture when possible.`;

  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];

  // Save user message
  await supabaseAdmin.from('chat_messages').insert({ room_id, role: 'user', content: message });

  try {
    let response = await chat({ messages, systemPrompt, tools: LAYOUT_FUNCTIONS, model: model || 'gpt-4o' });

    // Execute any function calls
    const actions = [];
    for (const toolCall of response.tool_calls || []) {
      const fnName = toolCall.function?.name;
      const args   = JSON.parse(toolCall.function?.arguments || '{}');
      const result = await executeFunction(fnName, args, room_id, placements, room);
      actions.push({ function: fnName, args, result });
    }

    // If functions were called, get a natural language summary
    if (actions.length > 0) {
      const summaryMessages = [
        ...messages,
        { role: 'assistant', content: response.text || '' },
        { role: 'user', content: `Actions completed: ${JSON.stringify(actions.map(a => a.result))}. Summarize what was done in 1-2 sentences.` }
      ];
      const summaryRes = await chat({ messages: summaryMessages, systemPrompt, model: model || 'gpt-4o' });
      response.text = summaryRes.text;
    }

    // Save assistant response
    await supabaseAdmin.from('chat_messages').insert({
      room_id,
      role: 'assistant',
      content: response.text,
      tool_calls: actions.length > 0 ? actions : null,
      model_used: response.model_used,
    });

    res.json({ message: response.text, actions, model_used: response.model_used });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

**✅ Layer 9 is complete when:** User can type "move the sofa to the left wall" and the chatbot executes the move, or "suggest a sofa under $500" and the chatbot returns IKEA/Ashley options.

---

## LAYER 10 — 3D FURNITURE MODELING (Offline, Not User-Facing)

See Layer 5 section. The offline workflow:

```bash
# One-time run by a team member with MESHY_API_KEY set
node server/scripts/generateModels.js

# Then run Blender cleanup (optional, improves quality)
blender --background --python python/scripts/blender_fix.py

# Commit the cleaned GLBs
git add unity/Assets/Resources/Furniture/*.glb
git commit -m "Add AI-generated furniture GLB prefabs"
```

**Fallback if Meshy is unavailable:** Download free GLB models from [Kenney.nl Furniture Kit](https://kenney.nl/assets/furniture-kit) (CC0, free for all uses). Name the files by category: `sofa.glb`, `bed.glb`, `desk.glb`, etc. Place in `unity/Assets/Resources/Furniture/`.

---

## LAYER 11 — EXPORT LAYER

**Goal:** User can export their room layout in multiple formats. All exports are downloadable in the browser.

### 11.1 — Export Service (`server/services/exportFormats.js`)

```javascript
import { DEFAULTS } from '../config/defaults.js';

/**
 * JSON export — versioned schema, used by Unity and archival
 */
export function buildLayoutJSON(room, placements) {
  return {
    schema_version: DEFAULTS.export.schemaVersion,
    layout_id:      room.id,
    created_at:     new Date().toISOString(),
    room: {
      name:              room.name,
      unit:              room.unit || 'inches',
      width:             room.width,
      depth:             room.depth,
      height:            room.height || 96,
      walls:             room.walls || [],
      scale_px_per_inch: room.scale_px_per_inch,
    },
    furniture: placements.map(p => ({
      id:          p.id,
      name:        p.name,
      category:    p.category,
      provider:    p.provider,
      provider_id: p.provider_id,
      width:       p.width,
      depth:       p.depth,
      height:      p.height,
      x:           p.x_inches,
      y:           p.y_inches,
      rotation:    p.rotation,
      color:       p.color,
      custom:      p.custom,
      model_url:   p.model_url || null,
    }))
  };
}

/**
 * DXF export — 2D floor plan for SketchUp, AutoCAD, etc.
 * Uses dxf-writer (npm install dxf-writer)
 */
export function buildDXF(room, placements) {
  const { Drawing } = require('dxf-writer');
  const d = new Drawing();
  d.setUnits('Inches');

  // Walls layer
  d.addLayer('WALLS', Drawing.ACI.WHITE, 'CONTINUOUS');
  d.setActiveLayer('WALLS');
  if (room.walls) {
    for (const wall of room.walls) {
      d.drawLine(wall.start[0], wall.start[1], wall.end[0], wall.end[1]);
    }
  } else {
    // Simple rect room
    d.drawLine(0, 0, room.width, 0);
    d.drawLine(room.width, 0, room.width, room.depth);
    d.drawLine(room.width, room.depth, 0, room.depth);
    d.drawLine(0, room.depth, 0, 0);
  }

  // Furniture layer
  d.addLayer('FURNITURE', Drawing.ACI.YELLOW, 'DASHED');
  d.setActiveLayer('FURNITURE');
  for (const p of placements) {
    d.drawRect(p.x_inches, p.y_inches, p.x_inches + p.width, p.y_inches + p.depth);
    d.drawText(p.x_inches + p.width / 2, p.y_inches + p.depth / 2, 6, 0, p.name);
  }

  return d.toDxfString();
}

/**
 * SVG export — vector floor plan, useful for PDF printing
 */
export function buildSVG(room, placements, svgWidth = 800) {
  const scale   = svgWidth / (room.width || 120);
  const svgH    = (room.depth || 100) * scale;
  const padding = 20;

  const walls = room.walls
    ? room.walls.map(w =>
        `<line x1="${w.start[0]*scale+padding}" y1="${w.start[1]*scale+padding}" ` +
        `x2="${w.end[0]*scale+padding}" y2="${w.end[1]*scale+padding}" ` +
        `stroke="#333" stroke-width="2"/>`
      ).join('\n')
    : `<rect x="${padding}" y="${padding}" width="${room.width*scale}" height="${room.depth*scale}" fill="none" stroke="#333" stroke-width="2"/>`;

  const furniture = placements.map(p => {
    const x = p.x_inches * scale + padding;
    const y = p.y_inches * scale + padding;
    const w = p.width * scale;
    const d = p.depth * scale;
    return `<rect x="${x}" y="${y}" width="${w}" height="${d}" fill="${p.color || '#d4a27a'}" stroke="#555" stroke-width="1" opacity="0.8"/>
            <text x="${x + w/2}" y="${y + d/2}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.min(12, w/4)}" fill="#333">${p.name}</text>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth + padding*2}" height="${svgH + padding*2}">
  <rect width="100%" height="100%" fill="#f5f4f0"/>
  ${walls}
  ${furniture}
</svg>`;
}
```

### 11.2 — Export Routes (`server/routes/export.js`)

```javascript
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase.js';
import { buildLayoutJSON, buildDXF, buildSVG } from '../services/exportFormats.js';

const router = express.Router();

async function getRoomAndPlacements(roomId, userId) {
  const [roomRes, placementsRes] = await Promise.all([
    supabaseAdmin.from('rooms').select('*').eq('id', roomId).eq('user_id', userId).single(),
    supabaseAdmin.from('placements').select('*').eq('room_id', roomId),
  ]);
  if (roomRes.error) throw new Error('Room not found');
  return { room: roomRes.data, placements: placementsRes.data || [] };
}

// POST /api/export/json/:room_id
router.post('/json/:room_id', requireAuth, async (req, res) => {
  const { room, placements } = await getRoomAndPlacements(req.params.room_id, req.user.id);
  const layout = buildLayoutJSON(room, placements);

  // Save snapshot
  await supabaseAdmin.from('layout_exports').insert({ room_id: room.id, layout_json: layout });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${room.name.replace(/\s+/g, '_')}_layout.json"`);
  res.json(layout);
});

// POST /api/export/dxf/:room_id
router.post('/dxf/:room_id', requireAuth, async (req, res) => {
  const { room, placements } = await getRoomAndPlacements(req.params.room_id, req.user.id);
  const dxfString = buildDXF(room, placements);
  res.setHeader('Content-Type', 'application/dxf');
  res.setHeader('Content-Disposition', `attachment; filename="${room.name.replace(/\s+/g, '_')}.dxf"`);
  res.send(dxfString);
});

// POST /api/export/svg/:room_id
router.post('/svg/:room_id', requireAuth, async (req, res) => {
  const { room, placements } = await getRoomAndPlacements(req.params.room_id, req.user.id);
  const svg = buildSVG(room, placements);
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Content-Disposition', `attachment; filename="${room.name.replace(/\s+/g, '_')}.svg"`);
  res.send(svg);
});

// GET /api/export/latest/:room_id — get most recent JSON export
router.get('/latest/:room_id', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('layout_exports')
    .select('*')
    .eq('room_id', req.params.room_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return res.status(404).json({ error: 'No export found' });
  res.json(data.layout_json);
});

export default router;
```

**✅ Layer 11 is complete when:** User clicks "Export" and can download JSON, DXF (opens in SketchUp), and SVG. The JSON round-trips cleanly into the Unity viewer.

---

## UNITY VIEWER — 3D WALKTHROUGH

### Unity Project Settings (REQUIRED before build)
1. File → Build Settings → WebGL
2. Player Settings → WebGL → Publishing Settings:
   - **Compression Format: Disabled** (REQUIRED for react-unity-webgl)
   - **Strip Engine Code: Off**
3. Player Settings → WebGL → Run In Background: **On**
4. Install Newtonsoft.Json via Package Manager

### `unity/Assets/Scripts/RoomBuilder.cs`

```csharp
using System;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json;
using System.Runtime.InteropServices;

[Serializable]
public class LayoutData {
    public RoomData room;
    public List<FurnitureData> furniture;
}

[Serializable]
public class RoomData {
    public float width, depth, height;
    public string unit;
    public List<WallData> walls;
}

[Serializable]
public class WallData {
    public float[] start, end;
    public float thickness;
}

[Serializable]
public class FurnitureData {
    public string id, name, category, color, model_url;
    public float width, depth, height, x, y, rotation;
}

public class RoomBuilder : MonoBehaviour {
    private const float INCH_TO_METER = 0.0254f;
    private List<GameObject> _sceneObjects = new List<GameObject>();

    // Called by React via sendMessage('RoomBuilder', 'LoadLayout', jsonStr)
    public void LoadLayout(string json) {
        try {
            var data = JsonConvert.DeserializeObject<LayoutData>(json);
            ClearScene();
            BuildRoom(data.room);
            foreach (var item in data.furniture) PlaceFurniture(item);
        } catch (Exception e) {
            Debug.LogError($"RoomBuilder: Failed to parse layout JSON: {e.Message}");
        }
    }

    private void ClearScene() {
        foreach (var obj in _sceneObjects) Destroy(obj);
        _sceneObjects.Clear();
    }

    private void BuildRoom(RoomData room) {
        float w = room.width  * INCH_TO_METER;
        float d = room.depth  * INCH_TO_METER;
        float h = (room.height > 0 ? room.height : 96) * INCH_TO_METER;

        // Floor
        var floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
        floor.name = "Floor";
        floor.transform.localScale = new Vector3(w / 10f, 1f, d / 10f);
        floor.transform.position   = new Vector3(w / 2f, 0, d / 2f);
        floor.GetComponent<Renderer>().material.color = new Color(0.93f, 0.91f, 0.88f);
        _sceneObjects.Add(floor);

        // Build from wall list if available
        if (room.walls != null && room.walls.Count > 0) {
            foreach (var wall in room.walls) BuildWall(wall, h);
        } else {
            // Fallback: rectangular room
            BuildRectRoom(w, d, h);
        }

        // Position camera
        Camera.main.transform.position = new Vector3(w / 2f, 1.6f, -0.5f);
        Camera.main.transform.LookAt(new Vector3(w / 2f, 1.6f, d / 2f));
    }

    private void BuildWall(WallData wall, float height) {
        float scale = INCH_TO_METER;
        float x1 = wall.start[0] * scale, z1 = wall.start[1] * scale;
        float x2 = wall.end[0]   * scale, z2 = wall.end[1]   * scale;
        float thickness = (wall.thickness > 0 ? wall.thickness : 4) * scale;
        float length = Mathf.Sqrt(Mathf.Pow(x2-x1,2) + Mathf.Pow(z2-z1,2));
        float angle  = Mathf.Atan2(z2-z1, x2-x1) * Mathf.Rad2Deg;

        var w = GameObject.CreatePrimitive(PrimitiveType.Cube);
        w.name = "Wall";
        w.transform.localScale    = new Vector3(length, height, thickness);
        w.transform.position      = new Vector3((x1+x2)/2f, height/2f, (z1+z2)/2f);
        w.transform.eulerAngles   = new Vector3(0, -angle, 0);
        w.GetComponent<Renderer>().material.color = Color.white;
        _sceneObjects.Add(w);
    }

    private void BuildRectRoom(float w, float d, float h) {
        void MakeWall(Vector3 pos, Vector3 scale, float rotY) {
            var wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wall.name = "Wall";
            wall.transform.position    = pos;
            wall.transform.localScale  = scale;
            wall.transform.eulerAngles = new Vector3(0, rotY, 0);
            wall.GetComponent<Renderer>().material.color = Color.white;
            _sceneObjects.Add(wall);
        }
        float t = 0.1f;
        MakeWall(new Vector3(w/2f, h/2f, 0),   new Vector3(w, h, t), 0);
        MakeWall(new Vector3(w/2f, h/2f, d),   new Vector3(w, h, t), 0);
        MakeWall(new Vector3(0,    h/2f, d/2f), new Vector3(t, h, d), 0);
        MakeWall(new Vector3(w,    h/2f, d/2f), new Vector3(t, h, d), 0);
    }

    private void PlaceFurniture(FurnitureData item) {
        float scale = INCH_TO_METER;
        float fx = item.x * scale + (item.width * scale) / 2f;
        // Flip Y: web coords (Y-down) → Unity world (Z-forward)
        float fz = (item.depth * scale) / 2f + item.y * scale;
        float fw = item.width  * scale;
        float fd = item.depth  * scale;
        float fh = (item.height > 0 ? item.height : 30) * scale;

        // Try loading prefab by category
        GameObject prefab = Resources.Load<GameObject>($"Furniture/{item.category}");
        GameObject obj    = prefab != null ? Instantiate(prefab) : GameObject.CreatePrimitive(PrimitiveType.Cube);

        obj.name = item.name;
        obj.transform.position    = new Vector3(fx, fh / 2f, fz);
        obj.transform.localScale  = new Vector3(fw, fh, fd);
        obj.transform.eulerAngles = new Vector3(0, item.rotation, 0);

        if (ColorUtility.TryParseHtmlString(item.color, out Color c)) {
            var rend = obj.GetComponent<Renderer>();
            if (rend) rend.material.color = c;
        }
        _sceneObjects.Add(obj);
    }
}
```

### `unity/Assets/Scripts/CameraController.cs`

```csharp
using UnityEngine;

public class CameraController : MonoBehaviour {
    public float moveSpeed = 3f;
    public float lookSpeed = 2f;
    private float _rotX;

    void Update() {
        // WASD
        float h = Input.GetAxis("Horizontal");
        float v = Input.GetAxis("Vertical");
        transform.Translate(new Vector3(h, 0, v) * moveSpeed * Time.deltaTime);

        // Q/E vertical
        if (Input.GetKey(KeyCode.Q)) transform.Translate(Vector3.down * moveSpeed * Time.deltaTime);
        if (Input.GetKey(KeyCode.E)) transform.Translate(Vector3.up   * moveSpeed * Time.deltaTime);

        // Right-click mouse look
        if (Input.GetMouseButton(1)) {
            _rotX -= Input.GetAxis("Mouse Y") * lookSpeed;
            _rotX  = Mathf.Clamp(_rotX, -80f, 80f);
            transform.localEulerAngles = new Vector3(
                _rotX,
                transform.localEulerAngles.y + Input.GetAxis("Mouse X") * lookSpeed,
                0
            );
        }
    }
}
```

### Unity WebGL React Component (`client/src/components/viewer/UnityViewer.jsx`)

```jsx
import { Unity, useUnityContext } from 'react-unity-webgl';
import { useEffect, useState } from 'react';

export default function UnityViewer({ layoutJson, onClose }) {
  const [fullscreen, setFullscreen] = useState(false);

  const { unityProvider, sendMessage, isLoaded, loadingProgression } = useUnityContext({
    loaderUrl:    '/unity/Build/vision-studio-viewer.loader.js',
    dataUrl:      '/unity/Build/vision-studio-viewer.data',
    frameworkUrl: '/unity/Build/vision-studio-viewer.framework.js',
    codeUrl:      '/unity/Build/vision-studio-viewer.wasm',
  });

  useEffect(() => {
    if (isLoaded && layoutJson) {
      sendMessage('RoomBuilder', 'LoadLayout', JSON.stringify(layoutJson));
    }
  }, [isLoaded, layoutJson, sendMessage]);

  return (
    <div className={`${fullscreen ? 'fixed inset-0' : 'relative w-full aspect-video'} bg-black z-50 flex flex-col rounded-xl overflow-hidden`}>
      <div className="flex justify-between items-center px-4 py-2 bg-stone-900 text-white">
        <span className="text-sm font-medium">3D Room View</span>
        <div className="flex gap-2">
          <button onClick={() => setFullscreen(f => !f)} className="text-stone-400 hover:text-white text-sm">
            {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
          <button onClick={onClose} className="text-stone-400 hover:text-white text-sm ml-3">✕</button>
        </div>
      </div>

      {!isLoaded && (
        <div className="flex-1 flex flex-col items-center justify-center text-stone-400">
          <div className="w-48 bg-stone-700 rounded-full h-2 mb-3">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.round(loadingProgression * 100)}%` }}
            />
          </div>
          <p className="text-sm">Loading 3D viewer... {Math.round(loadingProgression * 100)}%</p>
        </div>
      )}

      <Unity
        unityProvider={unityProvider}
        style={{ flex: 1, display: isLoaded ? 'block' : 'none' }}
      />

      <div className="px-4 py-1 bg-stone-900 text-stone-500 text-xs text-center">
        WASD — move &nbsp;|&nbsp; Right-click + drag — look &nbsp;|&nbsp; Q/E — up/down
      </div>
    </div>
  );
}
```

---

## SERVER ENTRY POINT

### `server/index.js`

```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

import authRoutes        from './routes/auth.js';
import roomRoutes        from './routes/rooms.js';
import furnitureRoutes   from './routes/furniture.js';
import layoutRoutes      from './routes/layout.js';
import chatRoutes        from './routes/chat.js';
import exportRoutes      from './routes/export.js';
import recognitionRoutes from './routes/recognition.js';

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173'], credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth',        authRoutes);
app.use('/api/rooms',       roomRoutes);
app.use('/api/furniture',   furnitureRoutes);
app.use('/api/layout',      layoutRoutes);
app.use('/api/chat',        chatRoutes);
app.use('/api/export',      exportRoutes);
app.use('/api/recognition', recognitionRoutes);

app.use(errorHandler);

app.listen(PORT, () => console.log(`Vision Studio backend running on :${PORT}`));
```

### `server/middleware/errorHandler.js`

```javascript
export function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
```

---

## ZUSTAND GLOBAL STATE (`client/src/store/layoutStore.js`)

```javascript
import { create } from 'zustand';
import { nanoid } from 'nanoid';
import api from '../lib/api';

export const useLayoutStore = create((set, get) => ({
  room:        null,
  furniture:   [],
  selectedId:  null,
  detections:  [],
  chatHistory: [],
  loading:     false,
  errors:      [],

  // Room actions
  setRoom: (room) => set({ room }),

  loadRoom: async (roomId) => {
    set({ loading: true });
    const { data } = await api.get(`/api/rooms/${roomId}`);
    set({ room: data, furniture: data.placements || [], loading: false });
  },

  saveRoomGeometry: async (walls, scale) => {
    const { room } = get();
    const { data } = await api.put(`/api/rooms/${room.id}`, { walls, scale_px_per_inch: scale });
    set({ room: data });
  },

  // Furniture actions
  addFurniture: async (item) => {
    const { room } = get();
    const { data } = await api.post('/api/furniture/placements', { ...item, room_id: room.id });
    set(state => ({ furniture: [...state.furniture, data] }));
  },

  updateFurniture: async (id, changes) => {
    set(state => ({
      furniture: state.furniture.map(f => f.id === id ? { ...f, ...changes } : f)
    }));
    // Debounce API call in real implementation
    await api.put(`/api/furniture/placements/${id}`, changes);
  },

  removeFurniture: async (id) => {
    set(state => ({ furniture: state.furniture.filter(f => f.id !== id) }));
    await api.delete(`/api/furniture/placements/${id}`);
  },

  selectFurniture:  (id) => set({ selectedId: id }),
  clearSelection:   ()   => set({ selectedId: null }),

  // Detection actions (Layer 2/6/7)
  setDetections: (detections) => set({
    detections: detections.map(d => ({ ...d, status: 'pending' }))
  }),
  confirmDetection:  (i) => set(state => ({
    detections: state.detections.map((d, idx) => idx === i ? { ...d, status: 'confirmed' } : d)
  })),
  dismissDetection:  (i) => set(state => ({
    detections: state.detections.map((d, idx) => idx === i ? { ...d, status: 'dismissed' } : d)
  })),

  // Chat
  addChatMessage: (msg) => set(state => ({ chatHistory: [...state.chatHistory, msg] })),
}));
```

---

## PACKAGE.JSON FILES

### `client/package.json`

```json
{
  "name": "vision-studio-client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.43.0",
    "axios": "^1.7.0",
    "konva": "^9.3.0",
    "nanoid": "^5.0.7",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-konva": "^18.2.10",
    "react-unity-webgl": "^9.5.0",
    "use-image": "^1.1.1",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "vite": "^5.3.0"
  }
}
```

### `server/package.json`

```json
{
  "name": "vision-studio-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "nodemon --experimental-specifier-resolution=node index.js",
    "start": "node index.js",
    "seed": "node scripts/seedFurniture.js",
    "generate-models": "node scripts/generateModels.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.0",
    "@google/generative-ai": "^0.14.0",
    "@supabase/supabase-js": "^2.43.0",
    "axios": "^1.7.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "dxf-writer": "^1.3.1",
    "express": "^4.19.2",
    "form-data": "^4.0.0",
    "multer": "^1.4.5-lts.1",
    "openai": "^4.52.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.3"
  }
}
```

---

## COLLISION DETECTION (`client/src/utils/collision.js`)

```javascript
export function getAABB(item, scale) {
  const w = item.width * scale;
  const d = item.depth * scale;
  const rad = (item.rotation * Math.PI) / 180;

  if (item.rotation === 0 || item.rotation === 180) {
    return { left: item.x, top: item.y, right: item.x + w, bottom: item.y + d };
  }
  if (item.rotation === 90 || item.rotation === 270) {
    return { left: item.x, top: item.y, right: item.x + d, bottom: item.y + w };
  }
  // General rotation
  const corners = [[0,0],[w,0],[w,d],[0,d]].map(([cx,cy]) => [
    item.x + cx * Math.cos(rad) - cy * Math.sin(rad),
    item.y + cx * Math.sin(rad) + cy * Math.cos(rad),
  ]);
  return {
    left:   Math.min(...corners.map(c => c[0])),
    top:    Math.min(...corners.map(c => c[1])),
    right:  Math.max(...corners.map(c => c[0])),
    bottom: Math.max(...corners.map(c => c[1])),
  };
}

export function overlaps(a, b) {
  return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
}

export function withinRoom(itemAABB, room, scale) {
  return (
    itemAABB.left   >= 0 &&
    itemAABB.top    >= 0 &&
    itemAABB.right  <= room.width * scale &&
    itemAABB.bottom <= room.depth * scale
  );
}

export function validateAll(movingItem, allItems, room, scale) {
  const errors = [];
  const box    = getAABB(movingItem, scale);

  if (!withinRoom(box, room, scale)) {
    errors.push(`${movingItem.name} extends outside the room.`);
  }
  for (const other of allItems) {
    if (other.id === movingItem.id) continue;
    if (overlaps(box, getAABB(other, scale))) {
      errors.push(`${movingItem.name} overlaps with ${other.name}.`);
    }
  }
  return { valid: errors.length === 0, errors };
}
```

---

## SCALE UTILITIES (`client/src/utils/scale.js`)

```javascript
export const computeScale = (p1, p2, realInches) => {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  return Math.sqrt(dx*dx + dy*dy) / realInches;
};

export const pxToInches  = (px,  scale) => px / scale;
export const inchesToPx  = (in_, scale) => in_ * scale;
export const snapToGrid  = (val, gridPx) => Math.round(val / gridPx) * gridPx;
```

---

## DEPLOYMENT CHECKLIST

Before marking the project as shipped:

- [ ] All 3 services start with a single `npm run dev` / `uvicorn` command
- [ ] Magic link auth works end-to-end
- [ ] Floor plan upload → parse → polygon overlay → scale calibration works
- [ ] Room photo → Grounding DINO detection → bounding box overlay → confirm to layout works
- [ ] Furniture catalog loads with IKEA + Ashley data (run seed script)
- [ ] Drag-and-drop furniture placement with collision validation works
- [ ] Chatbot executes at least: move, rotate, suggest, validate functions
- [ ] JSON export downloads with correct schema
- [ ] DXF export opens in SketchUp (or a DXF viewer)
- [ ] SVG export renders correctly
- [ ] Unity WebGL build loads in browser (`/unity/Build/` files served from `client/public/`)
- [ ] Unity renders room walls and furniture at correct scale
- [ ] WASD camera navigation works in Unity viewer
- [ ] All API endpoints return proper errors (not 500s) when API keys are missing
- [ ] No API keys hardcoded anywhere — all from `.env`
- [ ] `.env` files are in `.gitignore`

---

## KNOWN LIMITATIONS & STUBS

| Feature | Status | Note |
|---|---|---|
| SAM 3 (vs SAM 2) | SAM 2 in production | SAM 3 not yet on Replicate; swap model ID when available |
| Planner 5D export | Not implemented | No public API exists |
| Luma AI | Not implemented | Too expensive ($1/model); Meshy preferred |
| Kaedim | Not implemented | Enterprise only |
| IFC export | Not implemented | Stretch goal; use `ifcopenshell` if time permits |
| Real-time IKEA price sync | Static seed data | Re-run seed script to refresh |
| Mobile touch on canvas | Partial | Konva supports touch; test on device |
| VR walkthrough | Post-MVP | Extend Unity viewer with WebXR |

---

*Last updated: April 15, 2026 — Vision Studio Team*
*This file is the single source of truth for Claude Code. Read it top to bottom before starting any layer.*
