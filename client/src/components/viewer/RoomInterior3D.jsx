import { normalizeRoomInterior } from '@/data/roomInterior';

/**
 * Interior styling for 3D preview (floor color from Materials tab).
 * Wall shells, wallpaper planes, and wall art are omitted so the room stays open in 3D.
 *
 * @param {{ interior: unknown, roomW: number, roomD: number }} props
 * Meters for room dimensions.
 */
export default function RoomInterior3D({ interior, roomW, roomD }) {
  const config = normalizeRoomInterior(interior);

  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[roomW / 2, 0.001, roomD / 2]}>
      <planeGeometry args={[roomW, roomD]} />
      <meshStandardMaterial color={config.floorColor} roughness={0.85} />
    </mesh>
  );
}
