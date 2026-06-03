import { describe, expect, it } from 'vitest';
import {
  getRoomViewContext,
  getRoomViewShellRoom,
  getZoneBoundsInches,
  toLocalFurnitureInches,
} from '@/utils/roomView3d';

describe('roomView3d', () => {
  const wholeRoom = { width: 480, depth: 360, height: 96, name: 'Floorplan' };
  const livingZone = {
    id: 'zone-living',
    name: 'Living Room',
    bbox: [24, 36, 240, 200],
  };

  it('getZoneBoundsInches reads zone bbox', () => {
    const b = getZoneBoundsInches(livingZone);
    expect(b.width).toBe(216);
    expect(b.depth).toBe(164);
    expect(b.left).toBe(24);
  });

  it('uses active zone dimensions instead of whole room', () => {
    const ctx = getRoomViewContext(wholeRoom, livingZone);
    expect(ctx.widthIn).toBe(216);
    expect(ctx.depthIn).toBe(164);
    expect(ctx.isZoneScoped).toBe(true);
    expect(ctx.label).toBe('Living Room');
  });

  it('falls back to room dimensions when no zone', () => {
    const ctx = getRoomViewContext(wholeRoom, null);
    expect(ctx.widthIn).toBe(480);
    expect(ctx.depthIn).toBe(360);
    expect(ctx.isZoneScoped).toBe(false);
  });

  it('getRoomViewShellRoom narrows shell for zone scope', () => {
    const ctx = getRoomViewContext(wholeRoom, livingZone);
    const shell = getRoomViewShellRoom(wholeRoom, ctx);
    expect(shell.width).toBe(216);
    expect(shell.depth).toBe(164);
  });

  it('toLocalFurnitureInches subtracts zone origin', () => {
    const local = toLocalFurnitureInches({ x_inches: 100, y_inches: 80 }, 24, 36);
    expect(local.x).toBe(76);
    expect(local.y).toBe(44);
  });

  it('uses space geometry when zone is missing', () => {
    const ctx = getRoomViewContext(wholeRoom, null, {
      type: 'rect',
      bbox: { x: 10, y: 20, width: 120, height: 100 },
    });
    expect(ctx.widthIn).toBe(120);
    expect(ctx.originX).toBe(10);
    expect(ctx.originY).toBe(20);
  });
});
