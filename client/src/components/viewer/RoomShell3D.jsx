import { ROOM_SHELL_CEILING_OPACITY, ROOM_SHELL_WALL_THICKNESS_M } from '@/utils/roomShell3d';

const FLOOR_COLOR = '#ebe3d1';
const CEILING_COLOR = '#f8f6f1';
const WALL_COLOR = '#ddd4c4';

/**
 * Rectangular room shell for 3D preview: floor + optional translucent ceiling + optional walls.
 * Aligns with 2D RoomCanvas inches → meters (origin at room corner 0,0).
 *
 * Not mounted in RoomViewer3D since interior restore (RoomInterior3D owns walls).
 * All-spaces mode uses ProjectSpaceShell3D instead. Kept for reference and roomShell3d tests.
 */
export default function RoomShell3D({
  widthM: w,
  depthM: d,
  heightM: h,
  showWalls = false,
  floorColor = FLOOR_COLOR,
  wallColor = WALL_COLOR,
}) {
  const t = ROOM_SHELL_WALL_THICKNESS_M;

  return (
    <group name="room-shell">
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, 0, d / 2]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={floorColor} roughness={0.85} metalness={0.02} />
      </mesh>

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, h, d / 2]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial
          color={CEILING_COLOR}
          roughness={0.95}
          transparent
          opacity={ROOM_SHELL_CEILING_OPACITY}
          depthWrite={false}
        />
      </mesh>

      {showWalls && (
        <>
          <mesh castShadow receiveShadow position={[w / 2, h / 2, -t / 2]}>
            <boxGeometry args={[w, h, t]} />
            <meshStandardMaterial color={wallColor} roughness={0.9} />
          </mesh>
          <mesh castShadow receiveShadow position={[w / 2, h / 2, d + t / 2]}>
            <boxGeometry args={[w, h, t]} />
            <meshStandardMaterial color={wallColor} roughness={0.9} />
          </mesh>
          <mesh castShadow receiveShadow position={[-t / 2, h / 2, d / 2]}>
            <boxGeometry args={[t, h, d]} />
            <meshStandardMaterial color={wallColor} roughness={0.9} />
          </mesh>
          <mesh castShadow receiveShadow position={[w + t / 2, h / 2, d / 2]}>
            <boxGeometry args={[t, h, d]} />
            <meshStandardMaterial color={wallColor} roughness={0.9} />
          </mesh>
        </>
      )}
    </group>
  );
}
