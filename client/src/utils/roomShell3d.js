/**
 * Pure helpers for room-level 3D shell geometry (no React / Three.js).
 * RoomCanvas uses inches; RoomViewer3D uses meters.
 */

import { INCHES_TO_METERS } from '@/utils/furniture3d';

/** Default room size in inches when room metadata is missing (15' × 12' × 8'). */
export const DEFAULT_ROOM_DIMENSIONS_INCHES = Object.freeze({
  width: 180,
  depth: 144,
  height: 96,
});

/** Wall box thickness in meters (~2.4"). Centered on each perimeter edge. */
export const ROOM_SHELL_WALL_THICKNESS_M = 0.06;

/** Ceiling plane opacity (demo-friendly; keeps orbit view readable). */
export const ROOM_SHELL_CEILING_OPACITY = 0.22;

/**
 * @param {number | null | undefined} inches
 * @param {number} fallbackInches
 * @returns {number}
 */
export function inchesToMeters(inches, fallbackInches) {
  const value = typeof inches === 'number' && Number.isFinite(inches) ? inches : fallbackInches;
  return value * INCHES_TO_METERS;
}

/**
 * Room width/depth/height from layoutStore room object, with inch defaults.
 * @param {object | null | undefined} room
 * @returns {{
 *   widthIn: number,
 *   depthIn: number,
 *   heightIn: number,
 *   widthM: number,
 *   depthM: number,
 *   heightM: number,
 * }}
 */
export function getRoomShellDimensionsMeters(room) {
  const widthIn = room?.width ?? DEFAULT_ROOM_DIMENSIONS_INCHES.width;
  const depthIn = room?.depth ?? DEFAULT_ROOM_DIMENSIONS_INCHES.depth;
  const heightIn = room?.height ?? DEFAULT_ROOM_DIMENSIONS_INCHES.height;

  return {
    widthIn,
    depthIn,
    heightIn,
    widthM: inchesToMeters(widthIn, DEFAULT_ROOM_DIMENSIONS_INCHES.width),
    depthM: inchesToMeters(depthIn, DEFAULT_ROOM_DIMENSIONS_INCHES.depth),
    heightM: inchesToMeters(heightIn, DEFAULT_ROOM_DIMENSIONS_INCHES.height),
  };
}
