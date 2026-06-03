# Vision Studio — Demo Video

## Watch

After recording, the demo is saved as:

**[`vision-studio-demo.webm`](./vision-studio-demo.webm)**

(1920×1080 WebM from Playwright; plays in Chrome, Firefox, and VLC.)

**Length:** ~**2 minutes** (120s) — scripted pauses in `e2e/tests/vision-studio-demo.spec.js` (`HOLD` timings + `DEMO_TARGET_MS`).

## What the demo covers

1. **Landing** — editorial homepage and workflow scroll
2. **Studio** — project dashboard
3. **New project** — template-based living room setup
4. **2D editor** — starter catalog placement (sofa + coffee table)
5. **Materials** — wall color presets
6. **3D** — Overview / Walkthrough camera presets
7. **Export** — JSON layout download
8. **Chat** — Design Inspiration Assistant
9. **Home** — closing frame

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

Prerequisites: Node 18+, client + server dev deps installed.

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
