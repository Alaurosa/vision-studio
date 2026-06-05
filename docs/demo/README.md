# Vision Studio — Demo Video

## Watch

After recording, the demo is saved as:

**[`vision-studio-demo.webm`](./vision-studio-demo.webm)**

(1920×1080 WebM from Playwright; plays in Chrome, Firefox, and VLC.)

**Length:** ~**2 minutes** (120s) — scripted pauses in `e2e/tests/vision-studio-demo.spec.js` (`HOLD` timings + `DEMO_TARGET_MS`).

## What the demo covers

1. **Landing** → **Studio** — product intro
2. **Upload floorplan** — AI analysis pipeline + room zone editor (mocked parse for reliable recording)
3. **Project vision** — style chips + assistant direction
4. **Space Assistant** — furnish living room, then move furniture via chat
5. **3D** — orbit / zoom / Walkthrough & Overview presets (Screen Studio–style smooth camera moves)

**Screen Studio–style zoom:** `e2e/helpers/demo-motion.js` zooms the viewport toward each click target and during key holds (upload preview, floorplan zones, 2D layout, 3D canvas).
6. **Confirmation** — project summary before editor

Recording uses deterministic API mocks (`e2e/helpers/demo-mocks.js`) so no OpenAI/Python is required.

## Automated tests

Fast smoke (editor flow, no recording):

```bash
cd e2e && npm install && npm test
```

~2 min demo recording + copy to this folder:

```bash
cd e2e && npm run demo && node scripts/copy-demo-video.js
```

Server API smoke: `cd server && npm run test:e2e`

## Record again

Prerequisites: Node 18+, client + server dev deps installed. The demo uploads **`floorplan2.jpg`** from the repo root (also copied to `e2e/fixtures/floorplan2.jpg`).

```bash
# Terminal A (if not using Playwright webServer auto-start)
cd server && npm run dev

# Terminal B
cd client && npm run dev

# Record
cd e2e
npm install
npx playwright install chromium
npm run demo

# Copy to docs/demo/
node scripts/copy-demo-video.js
```

To lengthen the recording, raise values in `HOLD` inside `vision-studio-demo.spec.js`, or add delay: `PLAYWRIGHT_SLOW_MO=50 npm run demo`

Headed (watch while recording): `npm run demo:headed`

## Notes

- Recording uses **guest/demo mode** (no Supabase required) when the API runs in fallback mode.
- Floorplan AI upload and Python services are not shown (need `OPENAI_API_KEY` + Python on :5001).
- For a narrated cut, import `vision-studio-demo.webm` into iMovie, DaVinci Resolve, or CapCut and add voiceover.
