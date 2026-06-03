import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { useLayoutStore, furnitureBelongsToZoneId } from '@/store/layoutStore';
import { CATEGORY_COLORS } from '@/utils/constants';
import { getRotatedBoundingBox } from '@/utils/scale';
import SmartFurnitureModel from '@/components/viewer/SmartFurnitureModel';
import ProjectSpaceShell3D from '@/components/viewer/ProjectSpaceShell3D';
import {
  buildProject3dSpaces,
  getProjectOverviewCamera,
  INCHES_TO_METERS,
} from '@/utils/projectFloorplan3d';
import { toLocalFurnitureInches } from '@/utils/roomView3d';
import { getFurnitureRenderDimensionsInches } from '@/utils/furniture3d';
import { normalizeRoomInterior } from '@/data/roomInterior';

const IN_TO_M = INCHES_TO_METERS;

function ProjectFurnitureGroup({ space, furniture, roomInterior }) {
  const items = furniture.filter((it) => furnitureBelongsToZoneId(it, space.zoneId, space._zones || []));
  if (!items.length) return null;

  const ox = space.leftIn;
  const oy = space.topIn;

  return (
    <group>
      {items.map((it) => {
        const dimsIn = getFurnitureRenderDimensionsInches(it);
        const fw = dimsIn.width * IN_TO_M;
        const fd = dimsIn.depth * IN_TO_M;
        const fh = dimsIn.height * IN_TO_M;
        const bbox = getRotatedBoundingBox(dimsIn.width, dimsIn.depth, it.rotation || 0);
        const local = toLocalFurnitureInches(it, ox, oy);
        const x = (space.leftIn * IN_TO_M) + (local.x + bbox.width / 2) * IN_TO_M;
        const z = (space.topIn * IN_TO_M) + (local.y + bbox.depth / 2) * IN_TO_M;
        const color = it.color || CATEGORY_COLORS[it.category] || CATEGORY_COLORS.default;
        const rotY = -(it.rotation || 0) * Math.PI / 180;
        return (
          <group key={it.id} position={[x, fh / 2, z]} rotation={[0, rotY, 0]}>
            <SmartFurnitureModel item={it} w={fw} d={fd} h={fh} color={color} />
          </group>
        );
      })}
    </group>
  );
}

export default function ProjectViewer3D({ project = null, selectedSpaceId = null }) {
  const furniture = useLayoutStore((s) => s.furniture);
  const zones = useLayoutStore((s) => s.zones);
  const room = useLayoutStore((s) => s.room);
  const [resetSignal, setResetSignal] = useState(0);

  const layout = useMemo(
    () => buildProject3dSpaces(project, zones),
    [project, zones],
  );

  const camera = useMemo(
    () => getProjectOverviewCamera(layout),
    [layout],
  );

  const interior = useMemo(() => normalizeRoomInterior(room?.interior), [room?.interior]);

  const spacesWithZones = useMemo(
    () => layout.spaces.map((s) => ({ ...s, _zones: zones })),
    [layout.spaces, zones],
  );

  const { worldW, worldD } = layout;

  return (
    <div className="relative h-full w-full bg-paper-100">
      <p className="pointer-events-none absolute left-3 top-3 z-10 text-[10px] font-medium uppercase tracking-editorial text-ink-900/70">
        All spaces · floorplan overview
      </p>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap gap-2 p-3">
        <p className="text-[10px] uppercase tracking-editorial text-ink-900/50 w-full">
          Drag to orbit · Scroll to zoom · Inspect room shells and interiors from any angle
        </p>
        <button
          type="button"
          className="pointer-events-auto rounded-md border border-ink-900/12 bg-paper-50/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-editorial text-ink-900/80 backdrop-blur-sm hover:border-ink-900/25"
          onClick={() => setResetSignal((n) => n + 1)}
        >
          Reset view
        </button>
      </div>

      {layout.spaces.length === 0 ? (
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
          <Canvas
            key={resetSignal}
            shadows
            camera={{ position: camera.position, fov: camera.fov }}
          >
            <color attach="background" args={['#f4efe4']} />
            <ambientLight intensity={0.55} />
            <directionalLight
              castShadow
              intensity={1.05}
              position={[worldW * 0.6, layout.worldH * 2.5, worldD * 0.5]}
              shadow-mapSize={[2048, 2048]}
            />
            <Suspense fallback={null}>
              <Environment preset="apartment" />
            </Suspense>

            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[worldW / 2, 0, worldD / 2]}
              receiveShadow
            >
              <planeGeometry args={[worldW * 1.15, worldD * 1.15]} />
              <meshStandardMaterial color="#e8dec7" roughness={0.92} />
            </mesh>

            {spacesWithZones.map((space) => (
              <ProjectSpaceShell3D
                key={space.id}
                leftIn={space.leftIn}
                topIn={space.topIn}
                widthIn={space.widthIn}
                depthIn={space.depthIn}
                heightIn={space.heightIn}
                interior={interior}
              />
            ))}

            {spacesWithZones.map((space) => (
              <ProjectFurnitureGroup
                key={`furn-${space.id}`}
                space={space}
                furniture={furniture}
              />
            ))}

            <OrbitControls
              target={camera.target}
              minDistance={Math.max(worldW, worldD) * 0.35}
              maxDistance={Math.max(worldW, worldD) * 3.5}
              maxPolarAngle={Math.PI / 2.05}
            />
          </Canvas>
        </Suspense>
      )}
    </div>
  );
}
