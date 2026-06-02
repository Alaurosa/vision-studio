import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { useLayoutStore, selectVisibleFurniture } from '@/store/layoutStore';
import { CATEGORY_COLORS } from '@/utils/constants';
import { getRotatedBoundingBox } from '@/utils/scale';
import { cameraDistanceBounds, defaultCameraPose } from '@/utils/cameraNav';
import SmartFurnitureModel from './SmartFurnitureModel';
import RoomInterior3D from './RoomInterior3D';
import CameraCollider from './CameraCollider';
import { MinimapTracker, MinimapPanel } from './Minimap';
import {
  getFurnitureRenderDimensionsInches,
  INCHES_TO_METERS,
} from '@/utils/furniture3d';

const IN_TO_M = INCHES_TO_METERS;

export default function RoomViewer3D() {
  const room = useLayoutStore((s) => s.room);
  const furniture = useLayoutStore(selectVisibleFurniture);
  const w = (room?.width || 180) * IN_TO_M;
  const d = (room?.depth || 144) * IN_TO_M;
  const h = (room?.height || 96) * IN_TO_M;

  const controlsRef = useRef(null);
  const minimapCanvasRef = useRef(null);
  const [showMinimap, setShowMinimap] = useState(true);

  const distance = useMemo(() => cameraDistanceBounds(room), [room]);
  const home = useMemo(() => defaultCameraPose(room), [room]);

  const handleResetView = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.object.position.set(home.position.x, home.position.y, home.position.z);
    controls.target.set(home.target.x, home.target.y, home.target.z);
    controls.update();
  };

  return (
    <div className="w-full h-full bg-paper-100 relative">
      <Canvas shadows camera={{ position: [home.position.x, home.position.y, home.position.z], fov: 45 }}>
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

        {/* Furniture — each SmartFurnitureModel suspends locally; do not wrap Canvas in Suspense */}
        {furniture.map((it) => {
          const dimsIn = getFurnitureRenderDimensionsInches(it);
          const fw = dimsIn.width * IN_TO_M;
          const fd = dimsIn.depth * IN_TO_M;
          const fh = dimsIn.height * IN_TO_M;
          const bbox = getRotatedBoundingBox(dimsIn.width, dimsIn.depth, it.rotation || 0);
          const x = (it.x_inches + bbox.width / 2) * IN_TO_M;
          const z = (it.y_inches + bbox.depth / 2) * IN_TO_M;
          const color = it.color || CATEGORY_COLORS[it.category] || CATEGORY_COLORS.default;
          const rotY = -(it.rotation || 0) * Math.PI / 180;
          return (
            <group key={it.id} position={[x, fh / 2, z]} rotation={[0, rotY, 0]}>
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

        {/* Smooth pan / orbit / zoom (3.1): inertia + room-scaled zoom bounds, and
            a polar clamp so the camera can't orbit under the floor. */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={[home.target.x, home.target.y, home.target.z]}
          enableDamping
          dampingFactor={0.08}
          enablePan
          enableZoom
          enableRotate
          panSpeed={0.8}
          rotateSpeed={0.55}
          zoomSpeed={0.9}
          screenSpacePanning
          minDistance={distance.min}
          maxDistance={distance.max}
          maxPolarAngle={Math.PI / 2 - 0.02}
        />

        {/* Collision: keep the camera above the floor and out of furniture (3.2). */}
        <CameraCollider room={room} furniture={furniture} />

        {/* Minimap driver — reads the live camera pose and paints the 2D overlay (3.3). */}
        <MinimapTracker
          room={room}
          furniture={furniture}
          canvasRef={minimapCanvasRef}
          enabled={showMinimap}
        />
      </Canvas>

      {/* Navigation HUD (overlaid HTML, outside the WebGL canvas) */}
      <div className="pointer-events-none absolute right-4 top-4 z-10 flex gap-2">
        <button
          type="button"
          onClick={handleResetView}
          className="pointer-events-auto rounded-md border border-[#a89370]/60 bg-paper-100/90 px-2.5 py-1 text-xs font-medium text-ink-700 shadow-sm backdrop-blur-sm transition hover:bg-paper-200"
          title="Reset the camera to the default view"
        >
          Reset view
        </button>
        <button
          type="button"
          onClick={() => setShowMinimap((v) => !v)}
          className="pointer-events-auto rounded-md border border-[#a89370]/60 bg-paper-100/90 px-2.5 py-1 text-xs font-medium text-ink-700 shadow-sm backdrop-blur-sm transition hover:bg-paper-200"
          title="Toggle the top-down minimap"
        >
          {showMinimap ? 'Hide map' : 'Show map'}
        </button>
      </div>

      {showMinimap && <MinimapPanel canvasRef={minimapCanvasRef} />}
    </div>
  );
}
