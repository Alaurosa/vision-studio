import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';

const IN_TO_M = 0.0254;

function getSpaceRoomId(space) {
  return space?.roomId ?? space?.room_id ?? null;
}

function getZoneBBox(zone) {
  if (Array.isArray(zone?.bbox) && zone.bbox.length === 4) return zone.bbox;
  return null;
}

function resolveFloorplanSource(projectSpaces, roomsById) {
  const candidates = [];
  for (const space of Array.isArray(projectSpaces) ? projectSpaces : []) {
    const rid = getSpaceRoomId(space);
    if (rid && roomsById[rid]) candidates.push(roomsById[rid]);
  }
  const uniq = [];
  const seen = new Set();
  for (const room of candidates) {
    if (!room?.id || seen.has(room.id)) continue;
    seen.add(room.id);
    uniq.push(room);
  }
  return uniq.find((room) => Array.isArray(room?.zones) && room.zones.length > 0) || null;
}

function buildBlocksFromZones(projectSpaces = [], sourceRoom = null) {
  const zones = Array.isArray(sourceRoom?.zones) ? sourceRoom.zones : [];
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const blocks = (Array.isArray(projectSpaces) ? projectSpaces : []).map((space, index) => {
    const zone = zoneById.get(space.zoneId) || zoneById.get(space.zone_id) || null;
    const bbox = getZoneBBox(zone);
    if (!bbox) return null;
    const [x1, y1, x2, y2] = bbox;
    return {
      id: space.id || `space-${index}`,
      type: space.type === 'exterior' ? 'exterior' : 'interior',
      x: x1,
      y: y1,
      width: Math.max(24, x2 - x1),
      depth: Math.max(24, y2 - y1),
      height: space.type === 'exterior' ? 48 : 84,
    };
  }).filter(Boolean);
  if (blocks.length === 0) return { blocks: [], maxX: 0, maxY: 0 };
  const maxX = Math.max(...blocks.map((b) => b.x + b.width));
  const maxY = Math.max(...blocks.map((b) => b.y + b.depth));
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
  const sourceRoom = useMemo(
    () => resolveFloorplanSource(projectSpaces, roomsById),
    [projectSpaces, roomsById],
  );
  const { blocks, maxX, maxY } = useMemo(
    () => buildBlocksFromZones(projectSpaces, sourceRoom),
    [projectSpaces, sourceRoom],
  );
  const worldW = Math.max(6, maxX * IN_TO_M);
  const worldD = Math.max(6, maxY * IN_TO_M);
  const camHeight = Math.max(worldW, worldD) * 0.8;

  return (
    <div className="relative h-full w-full bg-paper-100">
      {blocks.length === 0 ? (
        <div className="absolute inset-0 grid place-items-center">
          <div className="panel max-w-md p-5 text-center">
            <p className="eyebrow mb-2 text-ink-500">3D Preview Unavailable</p>
            <p className="text-sm text-ink-600">
              3D preview needs confirmed floorplan geometry. Review spaces to finalize zone alignment first.
            </p>
          </div>
        </div>
      ) : (
        <Suspense fallback={null}>
          <Canvas camera={{ position: [worldW * 0.55, camHeight, worldD * 1.05], fov: 42 }}>
            <color attach="background" args={['#f4efe4']} />
            <ambientLight intensity={0.62} />
            <directionalLight intensity={1.0} position={[8, 12, 8]} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[worldW / 2, 0, worldD / 2]} receiveShadow>
              <planeGeometry args={[Math.max(worldW * 1.25, 10), Math.max(worldD * 1.25, 10)]} />
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
                    color={
                      space.type === 'exterior'
                        ? selected
                          ? '#5b9ac8'
                          : '#7aa8ca'
                        : selected
                          ? '#d19c58'
                          : '#bea07a'
                    }
                    transparent
                    opacity={0.9}
                  />
                </mesh>
              );
            })}
            <Grid
              args={[Math.max(worldW * 1.3, 12), Math.max(worldD * 1.3, 12)]}
              position={[worldW / 2, 0.001, worldD / 2]}
            />
            <OrbitControls target={[worldW / 2, 0.4, worldD / 2]} />
          </Canvas>
        </Suspense>
      )}
    </div>
  );
}
