import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROOM_INTERIOR,
  normalizeRoomInterior,
  resolveWallDisplayColor,
  roomWithInterior,
} from '@/data/roomInterior';

describe('roomInterior', () => {
  it('normalizes invalid input to defaults', () => {
    expect(normalizeRoomInterior(null)).toEqual(DEFAULT_ROOM_INTERIOR);
    expect(normalizeRoomInterior({ wallColor: 'bad', layoutIntent: 'nope' }).wallColor).toBe(
      DEFAULT_ROOM_INTERIOR.wallColor,
    );
  });

  it('keeps valid wallpaper and wall art', () => {
    const interior = normalizeRoomInterior({
      wallColor: '#aabbcc',
      wallpaperId: 'linen',
      wallArt: { wall: 'south', styleId: 'mirror' },
      layoutIntent: 'open-flow',
    });
    expect(interior.wallpaperId).toBe('linen');
    expect(interior.wallArt).toEqual({ wall: 'south', styleId: 'mirror' });
    expect(resolveWallDisplayColor(interior)).toBe('#f0ebe3');
  });

  it('hydrates interior from detected_objects on the room', () => {
    const room = roomWithInterior({
      id: 'r1',
      detected_objects: { interior: { wallColor: '#112233', layoutIntent: 'cozy-nook' } },
    });
    expect(room.interior.wallColor).toBe('#112233');
    expect(room.interior.layoutIntent).toBe('cozy-nook');
  });
});
