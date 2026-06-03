import { describe, expect, it } from 'vitest';
import { createWallpaperTexture } from '@/utils/wallpaperTexture';

describe('createWallpaperTexture', () => {
  it('returns null without a wallpaper id', () => {
    expect(createWallpaperTexture(null)).toBeNull();
    expect(createWallpaperTexture('')).toBeNull();
  });

  it('returns null for unknown wallpaper ids', () => {
    expect(createWallpaperTexture('unknown-style')).toBeNull();
  });
});
