# Vision Studio — User Guide

**CSE 115A Capstone · UCSC Spring 2026**

Vision Studio helps you redesign real rooms with confidence. Upload a floor plan or start from a template, review detected room geometry, describe your design vision, place furniture in a 2D editor, preview in 3D, and export your layout.

This guide is written for graders, testers, and end users — not developers.

---

## 1. Opening the App

### Local development

1. Start the API server, client, and Python AI service (see [README](../../README.md) or [Deployment Notes](../deployment/deployment-notes.md)).
2. Open **http://localhost:5173** in a modern browser (Chrome, Firefox, Edge, or Safari).

### Deployed demo

If your team has deployed the app:

- **Client (Vercel):** your production or preview URL
- **API health check:** `GET /health` on the Render server URL

You can browse the landing page and start a project **without signing in**. Guest work is saved locally in your browser until you choose **Save to account**.

---

## 2. Starting a New Project

There are three main entry paths:

| Path | How to start | Best for |
|------|--------------|----------|
| **Upload floor plan** | Home → **New project** or `/studio/new?startMode=upload` | Real floor plans (JPEG, PNG, WebP, or PDF) |
| **Blank / template room** | `/studio/new` → choose blank or a room template | Quick experiments without a floor plan |
| **Legacy single room** | `/studio/:roomId` | Older single-room editor (still supported) |

### Uploading a floor plan

1. Go to **New project** and choose the upload path.
2. Select an image or PDF of your floor plan.
3. Vision Studio sends the file to the AI pipeline, which:
   - Overlays a 20×20 grid on the image
   - Uses GPT Vision to identify habitable rooms (rectangles or polygons)
   - Snaps room edges to architectural walls with OpenCV
4. An animated analysis overlay shows progress through the pipeline.
5. When parsing completes, you enter the **space review** screen.

**Guest note:** Floor plan parsing uses a public, stateless endpoint — no account is required for upload and parse.

**Limitation:** AI-detected geometry is a starting point, not a survey-grade measurement. Always review and adjust rooms before editing furniture.

---

## 3. Reviewing and Adjusting Spaces

After upload (or when opening **Review Spaces** from the project hub):

1. Navigate to `/studio/project/:id/confirm?mode=adjust`.
2. The **Room Editor** shows your floor plan with color-coded room overlays.
3. You can:
   - **Move and resize** rectangular rooms
   - **Draw** new rectangle or polygon rooms
   - **Rename** rooms and set interior vs. exterior type
   - Toggle **Color Overlay** (filled vs. outline-only — visual only)
   - Edit room dimensions (decoupled from the drawn shape)
4. Confirm your spaces to proceed.

If you are not signed in, you may be prompted to create an account before continuing to Project Vision — this saves your floor plan to the server.

---

## 4. Project Vision (Design Guidance)

Before or during editing, collect your whole-property design intent:

1. Open **Project Vision Assistant** from the project hub or `/studio/project/:id/vision`.
2. Answer guided questions (mood, priorities, constraints, room focus) using chips or free-form chat.
3. Your answers build a **global vision** stored on the project.

**Important:** Vision does **not** silently change your layout. You must explicitly click **Apply Vision to Layout** (in the Materials tab or via the Space Assistant) to generate interior styling and starter furniture suggestions.

If you have already edited Materials manually, the app protects your changes unless you choose to regenerate.

---

## 5. The Editor Overview

Open the editor from the project hub (**Open Editor**) or navigate to:

- `/studio/project/:id/editor` — full-floorplan view (all spaces)
- `/studio/project/:id/editor/:spaceId` — single-room view

### Layout

| Area | Purpose |
|------|---------|
| **Top toolbar** | Save, 2D/3D toggle, grid, wall tools, undo/redo, validation, chat toggle |
| **Left sidebar** | Spaces, Furniture, Materials, Layers, Export tabs |
| **Center canvas** | 2D Konva editor or 3D preview |
| **Bottom bar** | Space switcher (All Spaces + interior/exterior rooms) |
| **Right panel** | Space Assistant chat (optional) |

---

## 6. Working in the 2D Editor

### Canvas navigation

- **Pan:** drag the background (or use scroll wheel where supported)
- **Zoom:** scroll or pinch

### Selecting a space

- Use the **bottom bar** or **Spaces** tab to focus on one room.
- Furniture placement is constrained to the active space when a zone is selected.

### Wall and floor tools (room-scoped view only)

Available in 2D mode from the toolbar:

| Tool | What it does |
|------|--------------|
| **Wall points** | Drag wall joints on segment-format walls (snaps to 6" grid) |
| **Resize floor** | Drag orange handles on E/S/SE to change floor width and depth |

Press **Esc** to clear active wall/resize tools.

**Limitation:** Scanned polygon outlines from floor plans cannot use wall-point editing the same way as rectangular rooms.

### Furniture placement (starter catalog)

1. Open the **Furniture** tab in the left sidebar.
2. Search or filter the **starter catalog** (9 curated items with Kenney 3D models).
3. Click a catalog card — the sidebar shows **Selected: … Click the canvas to place.**
4. Click inside the room canvas to place the item (grid-snapped, centered on click).
5. Press **Esc** or **Clear selection** to cancel placement mode.

### Moving, rotating, and resizing furniture

| Action | How |
|--------|-----|
| **Select** | Click a placed item |
| **Move** | Drag the selected item |
| **Rotate freely** | Use the Konva transformer rotation handle, or toolbar ±15° nudges, or the in-canvas rotation slider |
| **Resize** | Drag transformer corner handles (where enabled) |
| **Delete** | Select item → toolbar delete, or keyboard shortcut (see **?** shortcuts popover) |
| **Undo / Redo** | Toolbar buttons |

Placement enforces room/zone bounds and warns on overlap via toast notifications.

---

## 7. AI and Chat Guidance

Vision Studio offers three chat contexts:

| Assistant | Where | Scope |
|-----------|-------|-------|
| **Design Inspiration** | `/chat` | Global style ideas (no project required) |
| **Project Assistant** | `/studio/project/:id/chat` | Whole-property Q&A |
| **Space Assistant** | Editor chat panel (toggle in toolbar) | Current room layout — can move/add/remove furniture via AI tools |

### What the Space Assistant can do

The assistant can call server tools to:

- Move, rotate, add, remove, and swap furniture (IKEA/Ashley API catalog — 27 seeded items)
- Auto-arrange furniture
- Validate the layout
- Offer design advice and budget estimates
- Apply vision-driven layout suggestions (when you confirm)

Chat history for saved rooms is stored in the database. Draft/guest rooms keep chat in the browser session only.

**Limitation:** The editor Furniture tab uses the **starter catalog** (9 items) for click-to-place. The API catalog (IKEA/Ashley) is primarily accessed through chat tool calls, not the sidebar browse panel.

---

## 8. Materials and Design Options

Open the **Materials** tab to style the active room:

- **Wall paint** — preset colors
- **Wallpaper** — procedural patterns (synced to 2D and 3D)
- **Wall art** — place art on N/S/E/W walls
- **Layout intent** — guidance text tied to your vision
- **Apply Vision to Layout** — explicit action to generate vision-based interior and furniture suggestions

Manual edits are marked as user-owned and will not be overwritten by vision apply unless you choose **Regenerate layout from vision**.

---

## 9. Checking Fit and Collisions

Vision Studio validates furniture placement in two ways:

1. **Live feedback** — placing or moving items that overlap or extend outside the room triggers toast warnings.
2. **Validate layout** — toolbar button (or ask the Space Assistant to validate) runs a check for:
   - Items extending outside room bounds
   - Overlapping furniture (axis-aligned bounding box check with rotation support)

A clean layout shows: *"Layout looks clean — no overlaps or overflow."*

---

## 10. Saving and Loading

### Guest / draft mode

- Projects and rooms created without signing in are stored in **browser localStorage**.
- The toolbar shows **Save to account** — sign in or create an account to persist to Supabase.

### Signed-in users

- Click **Save Project** in the toolbar to persist room geometry, zones, interior styling, and all placements.
- Open saved projects from the **Studio dashboard** at `/studio`.
- The dashboard lists projects with status, space counts, and last-updated metadata.

**Limitation:** Some project metadata (e.g., floorplan zone geometry overlays) also lives in a local compatibility layer (`vs-projects-v1`) merged with API data. The authoritative room geometry is stored on `rooms` records in Supabase.

---

## 11. 3D Preview

Toggle **3D** in the toolbar to preview your layout.

### Single-room view

When a space is selected, the 3D viewer shows:

- Floor, walls, wallpaper, and wall art from Materials
- Placed furniture with Kenney GLB models (or procedural fallback if a model is missing)
- **Overview** and **Walkthrough** camera presets plus **Reset view**

### All-spaces (project) view

In full-floorplan mode, **3D** shows all linked spaces positioned relative to the floor plan bounding boxes.

**Limitations (prototype-level):**

- Polygon/L-shaped scanned walls are **not** extruded as full 3D wall meshes — the shell uses bounding-box dimensions.
- No first-person WASD navigation yet — orbit controls only.
- Project-wide 3D requires confirmed floor plan geometry; otherwise a fallback message is shown.
- Exterior spaces are placeholder shells, not fully modeled outdoor environments.
- 3D models are visual approximations; catalog inch dimensions remain the source of truth for placement.

---

## 12. Exporting

Open the **Export** tab in the left sidebar (or use export actions where available):

| Format | Contents |
|--------|----------|
| **JSON** | Room dimensions, walls, placements, metadata |
| **SVG** | 2D vector layout |
| **DXF** | CAD-compatible 2D layout |

Exports work for both saved rooms and local drafts (drafts send layout state in the request body).

---

## 13. Authentication

- **Sign in:** `/login` with email and password (Supabase Auth).
- **Demo account** (development only): `test@visionstudio.dev` / `test1234` with bearer token `vs-test-token-001`.
- Invalid auth tokens return 401 — the app does not silently fall back to guest mode for bad credentials.

---

## 14. Known Limitations Summary

| Feature | Status |
|---------|--------|
| Floor plan AI parse | Production-ready with manual review required |
| Room photo object detection | Requires Replicate API token; prototype-level |
| Starter furniture catalog | 9 items, click-to-place in editor |
| API furniture catalog (IKEA/Ashley) | 27 items, via chat tools |
| 3D wall extrusion for scanned polygons | Not implemented |
| Meshy image-to-3D generation | Optional server route; not used in live editor |
| Browser Playwright E2E | Local/gitignored tooling only |
| Marketing site (`marketing/`) | Separate Next.js app, not required for core workflow |

---

## 15. Quick Reference — Main URLs

| Page | Path |
|------|------|
| Landing | `/` |
| Studio dashboard | `/studio` |
| New project wizard | `/studio/new` |
| Project hub | `/studio/project/:id` |
| Review spaces | `/studio/project/:id/confirm?mode=adjust` |
| Project vision | `/studio/project/:id/vision` |
| Editor (all spaces) | `/studio/project/:id/editor` |
| Editor (one space) | `/studio/project/:id/editor/:spaceId` |
| Project chat | `/studio/project/:id/chat` |
| Global inspiration chat | `/chat` |

For technical architecture and deployment details, see the [Architecture Overview](../design/architecture-overview.md) and [Deployment Notes](../deployment/deployment-notes.md).
