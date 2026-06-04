import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore, selectVisibleFurniture, getZoneBounds } from '@/store/layoutStore';
import { CATEGORY_COLORS } from '@/utils/constants';
import { getRotatedBoundingBox } from '@/utils/scale';
import { cameraDistanceBounds, defaultCameraPose } from '@/utils/cameraNav';
import { zoneScopedDimensions, scopeFurnitureToOrigin } from '@/utils/roomScope';
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
  const zones = useLayoutStore((s) => s.zones);
  const activeZoneId = useLayoutStore((s) => s.activeZoneId);
  // useShallow keeps the furniture array reference stable when its contents are
  // unchanged (selectVisibleFurniture .filter()s a fresh array each call), so the
  // collider/minimap memos don't recompute on unrelated store updates.
  const visibleFurniture = useLayoutStore(useShallow(selectVisibleFurniture));

  // Scope the 3D scene to the selected room (zone), so it shows only that room —
  // mirroring how the 2D editor crops to the active zone. With no zone active
  // ("All Rooms") this falls back to the whole floor plan, unchanged.
  const activeZone = useMemo(
    () => (zones || []).find((z) => z.id === activeZoneId) || null,
    [zones, activeZoneId],
  );
  const bounds = getZoneBounds(activeZone);
  const { widthIn, depthIn, heightIn, originX, originY } = zoneScopedDimensions(room, bounds);
  const furniture = useMemo(
    () => scopeFurnitureToOrigin(visibleFurniture, originX, originY),
    [visibleFurniture, originX, originY],
  );

  const w = widthIn * IN_TO_M;
  const d = depthIn * IN_TO_M;
  const h = heightIn * IN_TO_M;

  // Camera / collision / minimap frame the scoped room, not the whole floor.
  // Spread keeps room.interior so wallpaper + floor styling still resolve.
  const scopedRoom = useMemo(
    () => ({ ...room, width: widthIn, depth: depthIn, height: heightIn }),
    [room, widthIn, depthIn, heightIn],
  );

  const controlsRef = useRef(null);
  const minimapCanvasRef = useRef(null);
  const [showMinimap, setShowMinimap] = useState(true);

  const distance = useMemo(() => cameraDistanceBounds(scopedRoom), [scopedRoom]);
  const home = useMemo(() => defaultCameraPose(scopedRoom), [scopedRoom]);

  const handleResetView = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.object.position.set(home.position.x, home.position.y, home.position.z);
    controls.target.set(home.target.x, home.target.y, home.target.z);
    controls.update();
  };

  // Re-frame the camera when the active room (zone) or its size changes, so
  // switching rooms in the 2D bar lands on a framed view of the new room.
  useEffect(() => {
    handleResetView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeZoneId, widthIn, depthIn, heightIn]);

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
            // Group sits at floor level; SmartFurnitureModel (GLB + procedural)
            // builds upward from Y=0, so pieces rest on the floor, not mid-air.
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
        <CameraCollider room={scopedRoom} furniture={furniture} />

        {/* Minimap driver — reads the live camera pose and paints the 2D overlay (3.3). */}
        <MinimapTracker
          room={scopedRoom}
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
