import { describe, expect, it } from 'vitest';
import {
  getDefaultRoomCameraPosition,
  getDefaultRoomCameraTarget,
  getRoomCameraDistance,
  getRoomOrbitDistanceLimits,
  normalizeRoomCameraDimensionsMeters,
} from '@/utils/roomCamera3d';
import { getRoomShellDimensionsMeters } from '@/utils/roomShell3d';

describe('roomCamera3d', () => {
  const smallRoom = { widthM: 3, depthM: 2.5, heightM: 2.4 };
  const largeRoom = { widthM: 6, depthM: 5, heightM: 3 };

  it('normalizeRoomCameraDimensionsMeters uses shell defaults for missing room', () => {
    const dims = normalizeRoomCameraDimensionsMeters(null);
    const shell = getRoomShellDimensionsMeters(null);
    expect(dims.widthM).toBeCloseTo(shell.widthM, 6);
    expect(dims.depthM).toBeCloseTo(shell.depthM, 6);
    expect(dims.heightM).toBeCloseTo(shell.heightM, 6);
  });

  it('getDefaultRoomCameraTarget is room center', () => {
    const [tx, , tz] = getDefaultRoomCameraTarget(smallRoom);
    expect(tx).toBeCloseTo(smallRoom.widthM / 2, 6);
    expect(tz).toBeCloseTo(smallRoom.depthM / 2, 6);
  });

  it('default camera position scales with room size', () => {
    const smallDist = getRoomCameraDistance(smallRoom);
    const largeDist = getRoomCameraDistance(largeRoom);
    expect(largeDist).toBeGreaterThan(smallDist);

    const [sx, , sz] = getDefaultRoomCameraPosition(smallRoom);
    const [lx, , lz] = getDefaultRoomCameraPosition(largeRoom);
    const smallOffset = Math.hypot(sx - smallRoom.widthM / 2, sz - smallRoom.depthM / 2);
    const largeOffset = Math.hypot(lx - largeRoom.widthM / 2, lz - largeRoom.depthM / 2);
    expect(largeOffset).toBeGreaterThan(smallOffset * 0.9);
  });

  it('overview camera stays outside room bounds', () => {
    const [x, y, z] = getDefaultRoomCameraPosition(smallRoom, 'overview');
    expect(x).toBeGreaterThanOrEqual(-0.5);
    expect(z).toBeGreaterThanOrEqual(-0.5);
    expect(y).toBeGreaterThan(0.5);
    expect(y).toBeLessThan(smallRoom.heightM * 2.5);
  });

  it('walkthrough camera sits in front of the room (negative z)', () => {
    const [x, y, z] = getDefaultRoomCameraPosition(smallRoom, 'walkthrough');
    expect(z).toBeLessThan(0);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThan(0.9);
    expect(y).toBeLessThan(smallRoom.heightM);
  });

  it('orbit distance limits are sane and ordered', () => {
    const { minDistance, maxDistance } = getRoomOrbitDistanceLimits(smallRoom);
    expect(minDistance).toBeGreaterThan(0.5);
    expect(maxDistance).toBeGreaterThan(minDistance);
    expect(maxDistance).toBeLessThan(50);
  });

  it('larger rooms allow farther max zoom-out', () => {
    const small = getRoomOrbitDistanceLimits(smallRoom);
    const large = getRoomOrbitDistanceLimits(largeRoom);
    expect(large.maxDistance).toBeGreaterThan(small.maxDistance);
  });
});
