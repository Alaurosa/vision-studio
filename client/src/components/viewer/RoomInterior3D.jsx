import {
  getWallArtStyle,
  normalizeRoomInterior,
  resolveWallAccentColor,
  resolveWallDisplayColor,
} from '@/data/roomInterior';

function WallArt3D({ interior, roomW, roomD, roomH }) {
  const art = interior.wallArt;
  if (!art) return null;
  const style = getWallArtStyle(art.styleId);
  if (!style) return null;

  const artW = Math.min(roomW * 0.28, 1.4);
  const artH = Math.min(roomH * 0.35, 1.1);
  const thickness = 0.02;
  let pos = [roomW / 2, roomH * 0.55, 0.04];
  let size = [artW, artH, thickness];

  switch (art.wall) {
    case 'north':
      pos = [roomW / 2, roomH * 0.55, 0.04];
      size = [artW, artH, thickness];
      break;
    case 'south':
      pos = [roomW / 2, roomH * 0.55, roomD - 0.04];
      size = [artW, artH, thickness];
      break;
    case 'west':
      pos = [0.04, roomH * 0.55, roomD / 2];
      size = [thickness, artH, artW * 0.7];
      break;
    case 'east':
      pos = [roomW - 0.04, roomH * 0.55, roomD / 2];
      size = [thickness, artH, artW * 0.7];
      break;
    default:
      break;
  }

  return (
    <mesh position={pos} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={style.color} roughness={0.4} metalness={art.styleId === 'mirror' ? 0.35 : 0} />
    </mesh>
  );
}

/**
 * @param {{ interior: unknown, roomW: number, roomD: number, roomH: number }} props
 * Meters for room dimensions.
 */
export default function RoomInterior3D({ interior, roomW, roomD, roomH }) {
  const config = normalizeRoomInterior(interior);
  const wallColor = resolveWallDisplayColor(config);
  const accent = resolveWallAccentColor(config);
  const floorColor = config.floorColor;
  const wallT = 0.06;

  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[roomW / 2, 0, roomD / 2]}>
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial color={floorColor} roughness={0.85} />
      </mesh>

      <mesh position={[roomW / 2, roomH / 2, 0]} receiveShadow>
        <boxGeometry args={[roomW, roomH, wallT]} />
        <meshStandardMaterial color={wallColor} roughness={config.wallpaperId ? 0.92 : 0.75} />
      </mesh>
      <mesh position={[roomW / 2, roomH / 2, roomD]} receiveShadow>
        <boxGeometry args={[roomW, roomH, wallT]} />
        <meshStandardMaterial color={wallColor} roughness={config.wallpaperId ? 0.92 : 0.75} />
      </mesh>
      <mesh position={[0, roomH / 2, roomD / 2]} receiveShadow>
        <boxGeometry args={[wallT, roomH, roomD]} />
        <meshStandardMaterial color={wallColor} roughness={config.wallpaperId ? 0.92 : 0.75} />
      </mesh>
      <mesh position={[roomW, roomH / 2, roomD / 2]} receiveShadow>
        <boxGeometry args={[wallT, roomH, roomD]} />
        <meshStandardMaterial color={wallColor} roughness={config.wallpaperId ? 0.92 : 0.75} />
      </mesh>

      {accent && config.wallpaperId && (
        <>
          <mesh position={[roomW / 2, roomH * 0.72, 0.031]}>
            <boxGeometry args={[roomW * 0.85, 0.04, 0.01]} />
            <meshStandardMaterial color={accent} roughness={0.95} />
          </mesh>
          <mesh position={[roomW / 2, roomH * 0.72, roomD - 0.031]}>
            <boxGeometry args={[roomW * 0.85, 0.04, 0.01]} />
            <meshStandardMaterial color={accent} roughness={0.95} />
          </mesh>
        </>
      )}

      <WallArt3D interior={config} roomW={roomW} roomD={roomD} roomH={roomH} />
    </>
  );
}
