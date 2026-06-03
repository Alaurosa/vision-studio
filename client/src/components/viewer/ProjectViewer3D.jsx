import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { projectFloorplanOverlays, toBboxArray } from '@/utils/floorplanGeometry';

const IN_TO_M = 0.0254;

function buildBlocksFromGeometry(overlays = []) {
  const blocks = overlays.map((space, index) => {
    // Polygon extrusion can be added later; for now, use confirmed polygon bbox as stable MVP.
    const [x1, y1, x2, y2] = toBboxArray(space.geometry);
    return {
      id: space.id || `space-${index}`,
      type: space.type === 'exterior' ? 'exterior' : 'interior',
      x: x1,
      y: y1,
      width: Math.max(24, x2 - x1),
      depth: Math.max(24, y2 - y1),
      height: space.type === 'exterior' ? 42 : 78,
    };
  });
  if (blocks.length === 0) return { blocks: [], maxX: 0, maxY: 0 };
  const maxX = Math.max(...blocks.map((b) => b.x + b.width));
  const maxY = Math.max(...blocks.map((b) => b.y + b.depth));
  return { blocks, maxX, maxY };
}

export default function ProjectViewer3D({ project = null, selectedSpaceId = null }) {
  const { overlays } = useMemo(() => projectFloorplanOverlays(project), [project]);
  const { blocks, maxX, maxY } = useMemo(
    () => buildBlocksFromGeometry(overlays),
    [overlays],
  );
  const worldW = Math.max(6, maxX * IN_TO_M);
  const worldD = Math.max(6, maxY * IN_TO_M);
  const camHeight = Math.max(worldW, worldD) * 0.8;

  return (
    <div className="relative h-full w-full bg-paper-100">
      <p className="pointer-events-none absolute left-3 top-3 z-10 text-[10px] font-medium uppercase tracking-editorial text-ink-900/70">
        All spaces · floorplan overview
      </p>
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
