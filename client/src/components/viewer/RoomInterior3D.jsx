import { normalizeRoomInterior } from '@/data/roomInterior';

/**
 * 3D room interior — floor only (no perimeter walls; furniture sits on the plane).
 * @param {{ interior: unknown, roomW: number, roomD: number, roomH: number }} props
 */
export default function RoomInterior3D({ interior, roomW, roomD }) {
  const config = normalizeRoomInterior(interior);

  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[roomW / 2, 0, roomD / 2]}>
      <planeGeometry args={[roomW, roomD]} />
      <meshStandardMaterial color={config.floorColor} roughness={0.85} />
    </mesh>
  );
}
