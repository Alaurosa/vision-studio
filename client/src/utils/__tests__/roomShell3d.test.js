import { describe, expect, it } from 'vitest';
import { INCHES_TO_METERS } from '@/utils/furniture3d';
import {
  DEFAULT_ROOM_DIMENSIONS_INCHES,
  ROOM_SHELL_WALL_THICKNESS_M,
  getRoomShellDimensionsMeters,
  inchesToMeters,
} from '@/utils/roomShell3d';

describe('roomShell3d', () => {
  it('inchesToMeters uses shared INCHES_TO_METERS constant', () => {
    expect(inchesToMeters(48, 0)).toBeCloseTo(48 * INCHES_TO_METERS, 6);
  });

  it('inchesToMeters falls back when value is not a finite number', () => {
    expect(inchesToMeters(undefined, 180)).toBeCloseTo(180 * INCHES_TO_METERS, 6);
    expect(inchesToMeters(null, 96)).toBeCloseTo(96 * INCHES_TO_METERS, 6);
  });

  it('getRoomShellDimensionsMeters applies defaults for missing room', () => {
    const dims = getRoomShellDimensionsMeters(null);
    expect(dims.widthIn).toBe(DEFAULT_ROOM_DIMENSIONS_INCHES.width);
    expect(dims.depthIn).toBe(DEFAULT_ROOM_DIMENSIONS_INCHES.depth);
    expect(dims.heightIn).toBe(DEFAULT_ROOM_DIMENSIONS_INCHES.height);
    expect(dims.widthM).toBeCloseTo(180 * INCHES_TO_METERS, 6);
  });

  it('getRoomShellDimensionsMeters converts custom room dimensions', () => {
    const dims = getRoomShellDimensionsMeters({ width: 240, depth: 180, height: 108 });
    expect(dims.widthIn).toBe(240);
    expect(dims.depthM).toBeCloseTo(180 * INCHES_TO_METERS, 6);
    expect(dims.heightM).toBeCloseTo(108 * INCHES_TO_METERS, 6);
  });

  it('documents wall thickness constant', () => {
    expect(ROOM_SHELL_WALL_THICKNESS_M).toBe(0.06);
  });
});
