import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  getWallArtStyle,
  getWallpaperPreset,
  normalizeRoomInterior,
  resolveWallDisplayColor,
} from '@/data/roomInterior';
import { createWallpaperTexture } from '@/utils/wallpaperTexture';

const WALL_OFFSET = 0.032;
const WALL_THICKNESS = 0.06;

function useWallpaperMaterial(wallpaperId, fallbackColor) {
  const texture = useMemo(() => createWallpaperTexture(wallpaperId), [wallpaperId]);

  const material = useMemo(() => {
    if (texture) {
      return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.88,
        metalness: 0,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: fallbackColor,
      roughness: 0.78,
      metalness: 0,
    });
  }, [texture, fallbackColor]);

  useEffect(() => {
    return () => {
      texture?.dispose();
      material.dispose();
    };
  }, [texture, material]);

  return material;
}

function WallpaperWall({ args, position, rotation, material }) {
  return (
    <mesh position={position} rotation={rotation} receiveShadow material={material}>
      <planeGeometry args={args} />
    </mesh>
  );
}

function GalleryWallArt({ wall, roomW, roomD, roomH, color }) {
  const frameW = Math.min(roomW * 0.12, 0.55);
  const frameH = Math.min(roomH * 0.22, 0.75);
  const gap = frameW * 0.35;
  const thickness = 0.025;
  const y = roomH * 0.52;
  const offsets = [-frameW - gap, 0, frameW + gap];

  const placements = offsets.map((offset) => {
    switch (wall) {
      case 'north':
        return { pos: [roomW / 2 + offset, y, WALL_OFFSET + 0.02], size: [frameW, frameH, thickness] };
      case 'south':
        return {
          pos: [roomW / 2 + offset, y, roomD - WALL_OFFSET - 0.02],
          size: [frameW, frameH, thickness],
        };
      case 'west':
        return { pos: [WALL_OFFSET + 0.02, y, roomD / 2 + offset], size: [thickness, frameH, frameW] };
      case 'east':
        return {
          pos: [roomW - WALL_OFFSET - 0.02, y, roomD / 2 + offset],
          size: [thickness, frameH, frameW],
        };
      default:
        return { pos: [roomW / 2, y, WALL_OFFSET], size: [frameW, frameH, thickness] };
    }
  });

  return (
    <>
      {placements.map(({ pos, size }, i) => (
        <mesh key={i} position={pos} castShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial color={color} roughness={0.45} />
        </mesh>
      ))}
    </>
  );
}

function WallArt3D({ interior, roomW, roomD, roomH }) {
  const art = interior.wallArt;
  if (!art) return null;
  const style = getWallArtStyle(art.styleId);
  if (!style) return null;

  if (art.styleId === 'gallery-set') {
    return (
      <GalleryWallArt
        wall={art.wall}
        roomW={roomW}
        roomD={roomD}
        roomH={roomH}
        color={style.color}
      />
    );
  }

  const artW = Math.min(roomW * 0.28, 1.4);
  const artH = Math.min(roomH * 0.35, 1.1);
  const thickness = 0.025;
  let pos = [roomW / 2, roomH * 0.52, WALL_OFFSET + 0.02];
  let size = [artW, artH, thickness];

  switch (art.wall) {
    case 'south':
      pos = [roomW / 2, roomH * 0.52, roomD - WALL_OFFSET - 0.02];
      break;
    case 'west':
      pos = [WALL_OFFSET + 0.02, roomH * 0.52, roomD / 2];
      size = [thickness, artH, artW * 0.7];
      break;
    case 'east':
      pos = [roomW - WALL_OFFSET - 0.02, roomH * 0.52, roomD / 2];
      size = [thickness, artH, artW * 0.7];
      break;
    default:
      break;
  }

  return (
    <mesh position={pos} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={style.color}
        roughness={0.4}
        metalness={art.styleId === 'mirror' ? 0.35 : 0}
      />
    </mesh>
  );
}

/**
 * Full interior rendering: floor, wall shells, wallpaper/paint planes, wall art.
 * @param {{ interior: unknown, roomW: number, roomD: number, roomH: number }} props
 */
export default function RoomInterior3D({ interior, roomW, roomD, roomH }) {
  const config = normalizeRoomInterior(interior);
  const preset = getWallpaperPreset(config.wallpaperId);
  const paintColor = resolveWallDisplayColor(config);
  const wallpaperActive = Boolean(config.wallpaperId && preset?.tint);

  const innerMaterial = useWallpaperMaterial(config.wallpaperId, paintColor);
  const shellColor = wallpaperActive ? preset.tint : paintColor;
  const shellMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: shellColor,
        roughness: 0.8,
        metalness: 0,
      }),
    [shellColor],
  );

  useEffect(() => () => shellMaterial.dispose(), [shellMaterial]);

  const repeatX = Math.max(2, roomW / 1.2);
  const repeatY = Math.max(2, roomH / 1.0);

  useEffect(() => {
    if (innerMaterial.map) {
      innerMaterial.map.repeat.set(repeatX, repeatY);
      innerMaterial.map.needsUpdate = true;
    }
  }, [innerMaterial, repeatX, repeatY]);

  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[roomW / 2, 0, roomD / 2]}>
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial color={config.floorColor} roughness={0.85} />
      </mesh>

      <mesh position={[roomW / 2, roomH / 2, -WALL_THICKNESS / 2]} receiveShadow material={shellMaterial}>
        <boxGeometry args={[roomW, roomH, WALL_THICKNESS]} />
      </mesh>
      <mesh
        position={[roomW / 2, roomH / 2, roomD + WALL_THICKNESS / 2]}
        receiveShadow
        material={shellMaterial}
      >
        <boxGeometry args={[roomW, roomH, WALL_THICKNESS]} />
      </mesh>
      <mesh position={[-WALL_THICKNESS / 2, roomH / 2, roomD / 2]} receiveShadow material={shellMaterial}>
        <boxGeometry args={[WALL_THICKNESS, roomH, roomD]} />
      </mesh>
      <mesh
        position={[roomW + WALL_THICKNESS / 2, roomH / 2, roomD / 2]}
        receiveShadow
        material={shellMaterial}
      >
        <boxGeometry args={[WALL_THICKNESS, roomH, roomD]} />
      </mesh>

      <WallpaperWall
        args={[roomW, roomH]}
        position={[roomW / 2, roomH / 2, WALL_OFFSET]}
        rotation={[0, 0, 0]}
        material={innerMaterial}
      />
      <WallpaperWall
        args={[roomW, roomH]}
        position={[roomW / 2, roomH / 2, roomD - WALL_OFFSET]}
        rotation={[0, Math.PI, 0]}
        material={innerMaterial}
      />
      <WallpaperWall
        args={[roomD, roomH]}
        position={[WALL_OFFSET, roomH / 2, roomD / 2]}
        rotation={[0, Math.PI / 2, 0]}
        material={innerMaterial}
      />
      <WallpaperWall
        args={[roomD, roomH]}
        position={[roomW - WALL_OFFSET, roomH / 2, roomD / 2]}
        rotation={[0, -Math.PI / 2, 0]}
        material={innerMaterial}
      />

      <WallArt3D interior={config} roomW={roomW} roomD={roomD} roomH={roomH} />
    </>
  );
}
