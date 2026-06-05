# Vision Studio — Demo Video

## Watch

After recording, the demo is saved as:

**[`vision-studio-demo.webm`](./vision-studio-demo.webm)**

(1920×1080 WebM from Playwright; plays in Chrome, Firefox, and VLC.)

**Length:** ~**1.5 minutes** (90s) — scripted pauses in the demo spec (`HOLD` timings).

**Recommended (real site):** `cd e2e && npm run demo:live` — live OpenAI floorplan segmentation on Python :5001, real chat API, **60fps** CDP+ffmpeg capture (`vision-studio-demo-live.spec.js`).

**Offline fallback:** `npm run demo` — mocked APIs for CI/no-keys (`vision-studio-demo.spec.js`, ~25fps Playwright WebM).

## What the demo covers

Full room design process end to end:

1. **Landing** → **Studio** — product intro
2. **Upload floorplan** — AI analysis pipeline + room zone editor (mocked parse for reliable recording)
3. **Project vision** — style chips + design direction
4. **Confirmation** — review spaces before editor
5. **2D editor** — catalog click-add (sofa + coffee table) on the canvas
6. **Space Assistant** — furnish living room, then move furniture via chat
7. **3D** — orbit, zoom, Walkthrough camera preset

**Screen Studio–style zoom:** `e2e/helpers/demo-motion.js` zooms the viewport toward each click target and during key holds (upload preview, floorplan zones, 2D layout, 3D canvas).

**Live recording** hits real `/api/public/parse-floorplan` → Python OpenAI vision grid+snap (labeled rooms, not generic OpenCV boxes). Requires server :3001, client :5173, python :5001, and `OPENAI_API_KEY` in root `.env`. Preflight: `npm run preflight:live`.

**Offline** `npm run demo` uses mocks (`e2e/helpers/demo-mocks.js`) when Python/keys are unavailable.

## Automated tests

Fast smoke (editor flow, no recording):

```bash
cd e2e && npm install && npm test
```

~1.5 min live demo (real AI, 60fps):

```bash
# Terminals: server :3001, client :5173, python :5001 (or let Playwright start them without SKIP_WEBSERVER)
cd e2e && npm run demo:live
```

Offline mocked demo:

```bash
cd e2e && npm run demo
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
```

To lengthen the recording, raise values in `HOLD` inside `vision-studio-demo.spec.js`, or add delay: `PLAYWRIGHT_SLOW_MO=50 npm run demo`

Headed (watch while recording): `npm run demo:headed`

## Notes

- Recording uses **guest/demo mode** (no Supabase required) when the API runs in fallback mode.
- Floorplan AI upload and Python services are not shown (need `OPENAI_API_KEY` + Python on :5001).
- For a narrated cut, import `vision-studio-demo.webm` into iMovie, DaVinci Resolve, or CapCut and add voiceover.
