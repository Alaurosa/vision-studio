import { describe, expect, it } from 'vitest';
import {
  isInteriorUserEdited,
  markInteriorUserPatch,
  normalizeRoomInterior,
  resolveWallDisplayColor,
} from '@/data/roomInterior';

describe('roomInterior', () => {
  it('resolveWallDisplayColor uses wallpaper tint when set', () => {
    const color = resolveWallDisplayColor({ wallColor: '#f5f0e8', wallpaperId: 'botanical' });
    expect(color).toBe('#e8efe4');
  });

  it('manual edits are detected via source user', () => {
    expect(isInteriorUserEdited(markInteriorUserPatch({}))).toBe(true);
    expect(isInteriorUserEdited({ source: 'vision' })).toBe(false);
  });

  it('preserves layout intent and wall art through normalize', () => {
    const n = normalizeRoomInterior({
      wallColor: '#112233',
      wallpaperId: 'stripe',
      wallArt: { wall: 'south', styleId: 'framed-print' },
      layoutIntent: 'cozy-nook',
      source: 'user',
      userEditedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(n.wallpaperId).toBe('stripe');
    expect(n.wallArt?.wall).toBe('south');
    expect(n.layoutIntent).toBe('cozy-nook');
  });
});
