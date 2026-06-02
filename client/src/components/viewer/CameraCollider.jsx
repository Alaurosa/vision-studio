import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  furnitureBoxesMeters,
  resolveCameraCollision,
  clampTargetToRoom,
} from '@/utils/cameraNav';

/**
 * Camera collision detection (Sprint 4, US3 · 3.2).
 *
 * Renders nothing — it runs every frame and nudges the active camera so it can
 * never drop below the floor or sit inside a furniture solid, and keeps the
 * orbit target inside the room so the view stays focused as the user pans.
 *
 * Works *with* OrbitControls rather than fighting it: OrbitControls re-derives
 * its spherical offset from the camera's current position on every update, so a
 * corrected position simply persists into the next frame (the camera "bumps"
 * against obstacles instead of clipping through them).
 *
 * Requires the active OrbitControls to be `makeDefault` so `state.controls`
 * resolves to it.
 */
export default function CameraCollider({ room, furniture, floorClearance = 0.12, padding = 0.08 }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);

  const boxes = useMemo(() => furnitureBoxesMeters(furniture), [furniture]);

  useFrame(() => {
    const pos = camera.position;
    const resolved = resolveCameraCollision(
      { x: pos.x, y: pos.y, z: pos.z },
      { boxes, floorClearance, padding },
    );
    if (resolved.collided) {
      camera.position.set(resolved.x, resolved.y, resolved.z);
    }

    const target = controls?.target;
    if (target) {
      const clamped = clampTargetToRoom({ x: target.x, y: target.y, z: target.z }, room);
      if (
        Math.abs(clamped.x - target.x) > 1e-4 ||
        Math.abs(clamped.y - target.y) > 1e-4 ||
        Math.abs(clamped.z - target.z) > 1e-4
      ) {
        target.set(clamped.x, clamped.y, clamped.z);
      }
    }
  });

  return null;
}
