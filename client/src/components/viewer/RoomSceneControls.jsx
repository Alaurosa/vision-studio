import { useCallback, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  getDefaultRoomCameraPosition,
  getDefaultRoomCameraTarget,
  getRoomOrbitDistanceLimits,
} from '@/utils/roomCamera3d';

/**
 * Configured OrbitControls + imperative camera reset for RoomViewer3D.
 * @param {{ widthM: number, depthM: number, heightM: number, navigationMode: 'overview' | 'walkthrough', resetSignal: number }} props
 */
export default function RoomSceneControls({ widthM, depthM, heightM, navigationMode, resetSignal }) {
  const { camera } = useThree();
  const controlsRef = useRef(null);
  const limits = getRoomOrbitDistanceLimits({ widthM, depthM, heightM });
  const [targetX, targetY, targetZ] = getDefaultRoomCameraTarget(
    { widthM, depthM, heightM },
    navigationMode,
  );

  const applyDefaultView = useCallback(() => {
    const pos = getDefaultRoomCameraPosition({ widthM, depthM, heightM }, navigationMode);
    const [tx, ty, tz] = getDefaultRoomCameraTarget({ widthM, depthM, heightM }, navigationMode);
    camera.position.set(pos[0], pos[1], pos[2]);
    if (controlsRef.current) {
      controlsRef.current.target.set(tx, ty, tz);
      controlsRef.current.minDistance = limits.minDistance;
      controlsRef.current.maxDistance = limits.maxDistance;
      controlsRef.current.update();
    }
  }, [camera, widthM, depthM, heightM, limits.minDistance, limits.maxDistance, navigationMode]);

  useEffect(() => {
    applyDefaultView();
  }, [applyDefaultView, resetSignal]);

  return (
    <OrbitControls
      ref={controlsRef}
      target={[targetX, targetY, targetZ]}
      minDistance={limits.minDistance}
      maxDistance={limits.maxDistance}
      enableDamping
      dampingFactor={0.08}
      enablePan
      screenSpacePanning
      maxPolarAngle={Math.PI * 0.495}
      minPolarAngle={0.06}
      makeDefault
    />
  );
}
