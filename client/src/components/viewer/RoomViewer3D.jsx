import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, Environment } from '@react-three/drei';
import { useLayoutStore, selectVisibleFurniture } from '@/store/layoutStore';
import { CATEGORY_COLORS } from '@/utils/constants';
import { getRotatedBoundingBox } from '@/utils/scale';
import SmartFurnitureModel from './SmartFurnitureModel';
import RoomInterior3D from './RoomInterior3D';
import RoomSceneControls from './RoomSceneControls';
import {
  getFurnitureRenderDimensionsInches,
  INCHES_TO_METERS,
} from '@/utils/furniture3d';
import { getRoomShellDimensionsMeters } from '@/utils/roomShell3d';
import { getDefaultRoomCameraPosition } from '@/utils/roomCamera3d';
import {
  getRoomViewContext,
  getRoomViewShellRoom,
  toLocalFurnitureInches,
} from '@/utils/roomView3d';

const IN_TO_M = INCHES_TO_METERS;

/**
 * @param {{ spaceGeometry?: object | null, viewLabel?: string | null }} [props]
 */
export default function RoomViewer3D({ spaceGeometry = null, viewLabel = null }) {
  const room = useLayoutStore((s) => s.room);
  const zones = useLayoutStore((s) => s.zones);
  const activeZoneId = useLayoutStore((s) => s.activeZoneId);
  const furniture = useLayoutStore(selectVisibleFurniture);

  const activeZone = useMemo(
    () => (activeZoneId ? zones.find((z) => z.id === activeZoneId) : null) || null,
    [zones, activeZoneId],
  );

  const viewContext = useMemo(
    () => getRoomViewContext(room, activeZone, spaceGeometry),
    [room, activeZone, spaceGeometry],
  );

  const shellRoom = useMemo(
    () => getRoomViewShellRoom(room, viewContext),
    [room, viewContext],
  );

  const shellDims = getRoomShellDimensionsMeters(shellRoom);
  const { widthM: w, depthM: d, heightM: h } = shellDims;
  const cameraDims = useMemo(() => ({ widthM: w, depthM: d, heightM: h }), [w, d, h]);
  const { originX, originY } = viewContext;

  const displayLabel = viewLabel || viewContext.label || room?.name || 'Room';

  const [navigationMode, setNavigationMode] = useState('overview');
  const [resetSignal, setResetSignal] = useState(0);

  const initialCameraPosition = useMemo(
    () => getDefaultRoomCameraPosition(cameraDims, navigationMode),
    [cameraDims, navigationMode],
  );

  const hintText =
    navigationMode === 'walkthrough'
      ? 'Walkthrough view · Drag to look around · Scroll to zoom · Right-drag to pan'
      : 'Drag to orbit · Scroll to zoom · Right-drag to pan';

  return (
    <div className="w-full h-full bg-paper-100 relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-1 p-3 sm:p-4">
        <p className="text-[10px] font-medium uppercase tracking-editorial text-ink-900/70">
          3D View: {displayLabel}
        </p>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-3 sm:p-4">
        <p className="text-[10px] uppercase tracking-editorial text-ink-900/50">{hintText}</p>
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-ink-900/12 bg-paper-50/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-editorial text-ink-900/80 backdrop-blur-sm hover:border-ink-900/25 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-sienna-500/40"
            onClick={() => setResetSignal((n) => n + 1)}
          >
            Reset view
          </button>
          <div
            className="inline-flex rounded-md border border-ink-900/12 bg-paper-50/90 p-0.5 backdrop-blur-sm"
            role="group"
            aria-label="Camera preset"
          >
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'walkthrough', label: 'Walkthrough' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={navigationMode === id}
                className={`rounded px-2.5 py-1 text-[10px] font-medium uppercase tracking-editorial focus-visible:ring-2 focus-visible:ring-sienna-500/40 ${
                  navigationMode === id
                    ? 'bg-ink-900/8 text-ink-900'
                    : 'text-ink-900/55 hover:text-ink-900'
                }`}
                onClick={() => {
                  setNavigationMode(id);
                  setResetSignal((n) => n + 1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Canvas shadows camera={{ position: initialCameraPosition, fov: 48 }}>
        <color attach="background" args={['#f4efe4']} />
        <ambientLight intensity={0.55} />
        <directionalLight
          castShadow
          position={[w, h * 2, d * 1.5]}
          intensity={1.1}
          shadow-mapSize={[2048, 2048]}
        />
        <Suspense fallback={null}>
          <Environment preset="apartment" />
        </Suspense>

        <RoomInterior3D interior={room?.interior} roomW={w} roomD={d} roomH={h} />

        {furniture.map((it) => {
          const dimsIn = getFurnitureRenderDimensionsInches(it);
          const fw = dimsIn.width * IN_TO_M;
          const fd = dimsIn.depth * IN_TO_M;
          const fh = dimsIn.height * IN_TO_M;
          const bbox = getRotatedBoundingBox(dimsIn.width, dimsIn.depth, it.rotation || 0);
          const local = toLocalFurnitureInches(it, originX, originY);
          const x = (local.x + bbox.width / 2) * IN_TO_M;
          const z = (local.y + bbox.depth / 2) * IN_TO_M;
          const color = it.color || CATEGORY_COLORS[it.category] || CATEGORY_COLORS.default;
          const rotY = -(it.rotation || 0) * Math.PI / 180;
          return (
            // Group at floor level; SmartFurnitureModel builds upward from Y=0
            // so furniture rests on the floor at its true size (scale fix).
            <group key={it.id} position={[x, 0, z]} rotation={[0, rotY, 0]}>
              <SmartFurnitureModel item={it} w={fw} d={fd} h={fh} color={color} />
            </group>
          );
        })}

        <Grid
          args={[w * 3, d * 3]}
          position={[w / 2, 0.002, d / 2]}
          cellColor="#c9b894"
          sectionColor="#a89370"
          fadeDistance={20}
          infiniteGrid={false}
        />

        <RoomSceneControls
          widthM={w}
          depthM={d}
          heightM={h}
          navigationMode={navigationMode}
          resetSignal={resetSignal}
        />
      </Canvas>
    </div>
  );
}
