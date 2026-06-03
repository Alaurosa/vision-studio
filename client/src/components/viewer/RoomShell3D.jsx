import {
  ROOM_SHELL_CEILING_OPACITY,
  ROOM_SHELL_WALL_THICKNESS_M,
} from '@/utils/roomShell3d';

const FLOOR_COLOR = '#ebe3d1';
const WALL_COLOR = '#faf7f1';
const CEILING_COLOR = '#f8f6f1';

/**
 * Rectangular room shell: floor (y=0), four perimeter walls, subtle ceiling.
 * Aligns with 2D RoomCanvas inches → meters (origin at room corner 0,0).
 * Polygon/L-shaped walls are not supported in this shell.
 */
export default function RoomShell3D({ widthM: w, depthM: d, heightM: h }) {
  const wallT = ROOM_SHELL_WALL_THICKNESS_M;

  return (
    <group name="room-shell">
      {/* Floor — top face at y=0; furniture groups sit at fh/2 above this plane */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, 0, d / 2]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.85} metalness={0.02} />
      </mesh>

      {/* Walls — thickness ROOM_SHELL_WALL_THICKNESS_M (0.06 m), centered on room edges (z=0, z=d, x=0, x=w) */}
      <mesh castShadow receiveShadow position={[w / 2, h / 2, 0]}>
        <boxGeometry args={[w, h, wallT]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
      </mesh>
      <mesh castShadow receiveShadow position={[w / 2, h / 2, d]}>
        <boxGeometry args={[w, h, wallT]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, h / 2, d / 2]}>
        <boxGeometry args={[wallT, h, d]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
      </mesh>
      <mesh castShadow receiveShadow position={[w, h / 2, d / 2]}>
        <boxGeometry args={[wallT, h, d]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
      </mesh>

      {/* Ceiling — light translucent plane so orbit camera stays usable */}
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
    </group>
  );
}
