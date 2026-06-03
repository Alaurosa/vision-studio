/**
 * Room interior design presets (walls, wallpaper, wall art, layout intent).
 * Stored on `room.interior` and persisted under `detected_objects.interior` on the server.
 */

export const DEFAULT_ROOM_INTERIOR = Object.freeze({
  wallColor: '#f5f0e8',
  floorColor: '#ebe3d1',
  wallpaperId: null,
  wallArt: null,
  layoutIntent: 'balanced',
});

export const WALL_COLOR_PRESETS = [
  { id: 'warm-white', color: '#f5f0e8', label: 'Warm white' },
  { id: 'soft-gray', color: '#e8e6e1', label: 'Soft gray' },
  { id: 'sage', color: '#d4ddd0', label: 'Sage' },
  { id: 'clay', color: '#e8ddd4', label: 'Clay' },
  { id: 'slate', color: '#c8ccd4', label: 'Slate' },
  { id: 'midnight', color: '#3d4451', label: 'Midnight' },
];

export const WALLPAPER_PRESETS = [
  { id: null, label: 'Paint only', tint: null, accent: null },
  { id: 'linen', label: 'Linen weave', tint: '#f0ebe3', accent: '#d9d1c5' },
  { id: 'botanical', label: 'Botanical', tint: '#e8efe4', accent: '#9bb396' },
  { id: 'stripe', label: 'Soft stripe', tint: '#ece8f2', accent: '#c5bdd8' },
  { id: 'terracotta', label: 'Terracotta', tint: '#f2e4da', accent: '#c98b6d' },
];

export const WALL_ART_STYLES = [
  { id: 'framed-print', label: 'Framed print', color: '#2a3548' },
  { id: 'gallery-set', label: 'Gallery set', color: '#4a5568' },
  { id: 'mirror', label: 'Mirror', color: '#b8c4d0' },
  { id: 'tapestry', label: 'Tapestry', color: '#8b7355' },
];

export const ROOM_WALLS = [
  { id: 'north', label: 'North wall' },
  { id: 'south', label: 'South wall' },
  { id: 'east', label: 'East wall' },
  { id: 'west', label: 'West wall' },
];

/** Layout intents inspired by common feng shui / spatial-flow ideas. */
export const LAYOUT_INTENTS = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Even visual weight and clear walkways on all sides.',
  },
  {
    id: 'open-flow',
    label: 'Open flow',
    description: 'Keep the center open so energy and movement can circulate.',
  },
  {
    id: 'cozy-nook',
    label: 'Cozy nook',
    description: 'Group seating and lamps into an intimate conversation zone.',
  },
  {
    id: 'commanding',
    label: 'Commanding view',
    description: 'Anchor beds and desks with a solid wall behind you.',
  },
];

const WALL_IDS = new Set(ROOM_WALLS.map((w) => w.id));
const WALLPAPER_IDS = new Set(WALLPAPER_PRESETS.map((p) => p.id).filter(Boolean));
const ART_IDS = new Set(WALL_ART_STYLES.map((a) => a.id));
const INTENT_IDS = new Set(LAYOUT_INTENTS.map((i) => i.id));

/**
 * @param {unknown} raw
 * @returns {typeof DEFAULT_ROOM_INTERIOR}
 */
export function normalizeRoomInterior(raw) {
  const base = { ...DEFAULT_ROOM_INTERIOR };
  if (!raw || typeof raw !== 'object') return base;

  const wallColor =
    typeof raw.wallColor === 'string' && /^#[0-9a-f]{6}$/i.test(raw.wallColor)
      ? raw.wallColor
      : base.wallColor;
  const floorColor =
    typeof raw.floorColor === 'string' && /^#[0-9a-f]{6}$/i.test(raw.floorColor)
      ? raw.floorColor
      : base.floorColor;

  const wallpaperId =
    raw.wallpaperId == null || WALLPAPER_IDS.has(raw.wallpaperId) ? raw.wallpaperId ?? null : null;

  let wallArt = null;
  if (raw.wallArt && typeof raw.wallArt === 'object') {
    const wall = WALL_IDS.has(raw.wallArt.wall) ? raw.wallArt.wall : null;
    const styleId = ART_IDS.has(raw.wallArt.styleId) ? raw.wallArt.styleId : null;
    if (wall && styleId) wallArt = { wall, styleId };
  }

  const layoutIntent = INTENT_IDS.has(raw.layoutIntent) ? raw.layoutIntent : base.layoutIntent;

  return { wallColor, floorColor, wallpaperId, wallArt, layoutIntent };
}

export function getWallpaperPreset(wallpaperId) {
  return WALLPAPER_PRESETS.find((p) => p.id === wallpaperId) || WALLPAPER_PRESETS[0];
}

export function getWallArtStyle(styleId) {
  return WALL_ART_STYLES.find((a) => a.id === styleId) || null;
}

/** Blend wallpaper tint over base wall paint for 3D / 2D display. */
export function resolveWallDisplayColor(interior) {
  const normalized = normalizeRoomInterior(interior);
  const preset = getWallpaperPreset(normalized.wallpaperId);
  if (!preset?.tint) return normalized.wallColor;
  return preset.tint;
}

export function resolveWallAccentColor(interior) {
  const preset = getWallpaperPreset(normalizeRoomInterior(interior).wallpaperId);
  return preset?.accent || null;
}

/**
 * Attach normalized interior onto a room record from API or draft.
 * @param {object | null | undefined} room
 */
export function roomWithInterior(room) {
  if (!room) return room;
  const fromDetected =
    room.detected_objects && typeof room.detected_objects === 'object'
      ? room.detected_objects.interior
      : null;
  return {
    ...room,
    interior: normalizeRoomInterior(room.interior || fromDetected),
  };
}
