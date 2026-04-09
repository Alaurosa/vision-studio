# Vision Studio

This repository contains a frontend-only skeleton for a future AI-powered room design app called Vision Studios.

## What this project includes

- **Next.js App Router** with TypeScript and Tailwind CSS
- **Zustand** for lightweight client state
- **Mock data only** for furniture, room layouts, and chat messages
- **Placeholder UI** for upload, editor, and landing screens
- **Strict TypeScript** and linting configuration

## Folder structure

- `app/` — entry points and page routes for `landing`, `upload`, and `editor`
- `components/` — reusable UI, layout, editor, and chat components
- `lib/mock/` — local mock data for furniture, layout, and chat
- `lib/` — placeholder service utilities for future implementation
- `store/` — Zustand client-side state
- `types/` — shared TypeScript interfaces
- `styles/` — global Tailwind styles

## What is mocked vs not built

### Mocked
- furniture catalog data
- room layout data
- chat assistant messages
- room analysis and layout generator functions
- upload experience and editor panel structure

### Not built
- backend or API routes
- real image upload processing
- actual AI layout generation
- drag-and-drop engine
- chat assistant logic
- database or authentication
- 3D scene rendering

## Future phases

1. Frontend skeleton
2. Mocked interactions
3. Backend integration
4. Real AI + provider integrations

## Run the project

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Run lint:

```bash
npm run lint
```

Format files:

```bash
npm run format
```

Created By: William Liu, Ethan Cao, Sriya Katreddi, and Ashley Kim
For CSE 115A Spring 2026 Capstone at UCSC
