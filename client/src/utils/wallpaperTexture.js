import * as THREE from 'three';
import { getWallpaperPreset } from '@/data/roomInterior';

/**
 * Build a repeating canvas texture for procedural wallpaper in the 3D viewer.
 * @param {string} wallpaperId
 * @returns {THREE.CanvasTexture | null}
 */
export function createWallpaperTexture(wallpaperId) {
  if (!wallpaperId || typeof document === 'undefined') return null;

  const preset = getWallpaperPreset(wallpaperId);
  if (!preset?.tint) return null;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const tint = preset.tint;
  const accent = preset.accent || preset.tint;

  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);

  switch (wallpaperId) {
    case 'linen': {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35;
      for (let x = 0; x < size; x += 8) {
        for (let y = 0; y < size; y += 8) {
          ctx.strokeRect(x + 0.5, y + 0.5, 6, 6);
        }
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'botanical': {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 48; i++) {
        const x = (i * 37) % size;
        const y = (i * 53) % size;
        ctx.beginPath();
        ctx.arc(x, y, 3 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'stripe': {
      for (let x = 0; x < size; x += 16) {
        ctx.fillStyle = x % 32 === 0 ? accent : tint;
        ctx.fillRect(x, 0, 8, size);
      }
      break;
    }
    case 'terracotta': {
      for (let y = 0; y < size; y += 14) {
        ctx.fillStyle = y % 28 === 0 ? accent : tint;
        ctx.fillRect(0, y, size, 7);
      }
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = accent;
      for (let x = 0; x < size; x += 24) {
        ctx.fillRect(x, 0, 2, size);
      }
      ctx.globalAlpha = 1;
      break;
    }
    default:
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
