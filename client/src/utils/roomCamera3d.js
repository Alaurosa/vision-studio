/**
 * Pure helpers for room-level 3D camera placement (no React / Three.js).
 * Room shell spans x: 0..widthM, z: 0..depthM, y: 0..heightM (meters).
 */

import { getRoomShellDimensionsMeters } from '@/utils/roomShell3d';

/**
 * @param {object | null | undefined} roomOrDims - layoutStore `room` or `{ widthM, depthM, heightM }`
 * @returns {{ widthM: number, depthM: number, heightM: number }}
 */
export function normalizeRoomCameraDimensionsMeters(roomOrDims) {
  if (
    roomOrDims &&
    typeof roomOrDims.widthM === 'number' &&
    typeof roomOrDims.depthM === 'number' &&
    typeof roomOrDims.heightM === 'number'
  ) {
    return {
      widthM: roomOrDims.widthM,
      depthM: roomOrDims.depthM,
      heightM: roomOrDims.heightM,
    };
  }
  const shell = getRoomShellDimensionsMeters(roomOrDims);
  return { widthM: shell.widthM, depthM: shell.depthM, heightM: shell.heightM };
}

/**
 * Longest horizontal span of the room footprint (meters).
 * @param {{ widthM: number, depthM: number, heightM: number }} dims
 */
export function getRoomCameraDistance(dims) {
  const { widthM, depthM, heightM } = normalizeRoomCameraDimensionsMeters(dims);
  const footprint = Math.max(widthM, depthM, 1);
  const vertical = Math.max(heightM * 0.85, 1);
  return Math.max(footprint * 1.15, vertical * 1.35, 2.8);
}

/**
 * Orbit target — room center, slightly above floor so furniture reads clearly.
 * @param {object | null | undefined} roomOrDims
 * @param {'overview' | 'walkthrough'} [mode]
 * @returns {[number, number, number]}
 */
export function getDefaultRoomCameraTarget(roomOrDims, mode = 'overview') {
  const { widthM, depthM, heightM } = normalizeRoomCameraDimensionsMeters(roomOrDims);
  const eyeY =
    mode === 'walkthrough'
      ? Math.min(Math.max(heightM * 0.42, 1.15), heightM * 0.88)
      : Math.min(Math.max(heightM * 0.32, 0.75), heightM * 0.55);
  return [widthM / 2, eyeY, depthM / 2];
}

/**
 * Default camera position outside the shell (not inside walls/floor).
 * @param {object | null | undefined} roomOrDims
 * @param {'overview' | 'walkthrough'} [mode]
 * @returns {[number, number, number]}
 */
export function getDefaultRoomCameraPosition(roomOrDims, mode = 'overview') {
  const { widthM, depthM, heightM } = normalizeRoomCameraDimensionsMeters(roomOrDims);
  const [tx, ty, tz] = getDefaultRoomCameraTarget(roomOrDims, mode);
  const dist = getRoomCameraDistance({ widthM, depthM, heightM });

  if (mode === 'walkthrough') {
    const margin = Math.max(dist * 0.22, 0.9);
    const eyeY = Math.min(Math.max(heightM * 0.42, 1.15), heightM * 0.88);
    return [widthM * 0.22, eyeY, -margin];
  }

  const azimuth = Math.PI / 4;
  const elevation = 0.42;
  const horizontal = dist * Math.cos(elevation);
  const x = tx + Math.cos(azimuth) * horizontal;
  const y = ty + dist * Math.sin(elevation) + heightM * 0.12;
  const z = tz + Math.sin(azimuth) * horizontal;
  return [x, y, z];
}

/**
 * Sensible OrbitControls distance limits from room size.
 * @param {object | null | undefined} roomOrDims
 * @returns {{ minDistance: number, maxDistance: number }}
 */
export function getRoomOrbitDistanceLimits(roomOrDims) {
  const { widthM, depthM, heightM } = normalizeRoomCameraDimensionsMeters(roomOrDims);
  const span = Math.max(widthM, depthM, heightM * 0.75, 1);
  const minDistance = Math.max(span * 0.28, 1.1);
  const maxDistance = Math.max(span * 4.2, minDistance + 3);
  return { minDistance, maxDistance };
}
