import { ROOM_SHELL_CEILING_OPACITY } from '@/utils/roomShell3d';

const FLOOR_COLOR = '#ebe3d1';
const CEILING_COLOR = '#f8f6f1';

/**
 * Rectangular room shell for 3D preview: floor + optional translucent ceiling.
 * Perimeter walls are omitted so furniture and layout stay visible from outside the room.
 * Aligns with 2D RoomCanvas inches → meters (origin at room corner 0,0).
 */
export default function RoomShell3D({ widthM: w, depthM: d, heightM: h }) {
  return (
    <group name="room-shell">
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, 0, d / 2]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.85} metalness={0.02} />
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
    </group>
  );
}
