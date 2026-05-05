import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';

const IN_TO_M = 0.0254;

function buildBlocks(projectSpaces = [], roomsById = {}) {
  const spaces = Array.isArray(projectSpaces) ? projectSpaces : [];
  const gap = 24;
  const maxRowWidth = 900;
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  const blocks = spaces.map((space, index) => {
    const rid = space.roomId ?? space.room_id ?? null;
    const linkedRoom = rid ? roomsById[rid] : null;
    const width = Math.max(120, Number(linkedRoom?.width) || (space.type === 'exterior' ? 280 : 220));
    const depth = Math.max(96, Number(linkedRoom?.depth) || (space.type === 'exterior' ? 200 : 160));
    if (x > 0 && x + width > maxRowWidth) {
      x = 0;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    const out = {
      id: space.id || `space-${index}`,
      type: space.type === 'exterior' ? 'exterior' : 'interior',
      x,
      y,
      width,
      depth,
      height: space.type === 'exterior' ? 60 : 96,
    };
    x += width + gap;
    rowHeight = Math.max(rowHeight, depth);
    return out;
  });

  const maxX = Math.max(400, ...blocks.map((b) => b.x + b.width + 40));
  const maxY = Math.max(300, ...blocks.map((b) => b.y + b.depth + 40));
  return { blocks, maxX, maxY };
}

export default function ProjectViewer3D({ projectSpaces = [], rooms = [], selectedSpaceId = null }) {
  const roomsById = useMemo(
    () =>
      (Array.isArray(rooms) ? rooms : []).reduce((acc, room) => {
        acc[room.id] = room;
        return acc;
      }, {}),
    [rooms],
  );
  const { blocks, maxX, maxY } = useMemo(
    () => buildBlocks(projectSpaces, roomsById),
    [projectSpaces, roomsById],
  );
  const worldW = maxX * IN_TO_M;
  const worldD = maxY * IN_TO_M;

  return (
    <div className="relative h-full w-full bg-paper-100">
      <div className="absolute left-4 top-4 z-10 text-xs font-mono text-ink-500">
        Full floorplan 3D massing preview
      </div>
      <Suspense fallback={null}>
        <Canvas camera={{ position: [worldW * 0.8, 8, worldD * 1.1], fov: 45 }}>
          <color attach="background" args={['#f4efe4']} />
          <ambientLight intensity={0.65} />
          <directionalLight intensity={1.1} position={[8, 12, 8]} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[worldW / 2, 0, worldD / 2]} receiveShadow>
            <planeGeometry args={[Math.max(worldW * 1.3, 18), Math.max(worldD * 1.3, 18)]} />
            <meshStandardMaterial color="#e8dec7" />
          </mesh>
          {blocks.map((space) => {
            const width = space.width * IN_TO_M;
            const depth = space.depth * IN_TO_M;
            const height = space.height * IN_TO_M;
            const x = (space.x + space.width / 2) * IN_TO_M;
            const z = (space.y + space.depth / 2) * IN_TO_M;
            const selected = selectedSpaceId === space.id;
            return (
              <mesh key={space.id} position={[x, height / 2, z]} castShadow receiveShadow>
                <boxGeometry args={[width, height, depth]} />
                <meshStandardMaterial
                  color={space.type === 'exterior' ? (selected ? '#5b9ac8' : '#7aa8ca') : selected ? '#d19c58' : '#bea07a'}
                  transparent
                  opacity={0.88}
                />
              </mesh>
            );
          })}
          <Grid args={[Math.max(worldW * 1.4, 20), Math.max(worldD * 1.4, 20)]} position={[worldW / 2, 0.001, worldD / 2]} />
          <OrbitControls target={[worldW / 2, 0.5, worldD / 2]} />
        </Canvas>
      </Suspense>
    </div>
  );
}
