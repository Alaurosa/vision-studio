import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { useLayoutStore, selectVisibleFurniture } from '@/store/layoutStore';
import { CATEGORY_COLORS } from '@/utils/constants';
import { getRotatedBoundingBox } from '@/utils/scale';
import SmartFurnitureModel from './SmartFurnitureModel';
import RoomShell3D from './RoomShell3D';
import { getFurnitureRenderDimensionsInches, INCHES_TO_METERS } from '@/utils/furniture3d';
import { getRoomShellDimensionsMeters } from '@/utils/roomShell3d';

const IN_TO_M = INCHES_TO_METERS;

export default function RoomViewer3D() {
  const room = useLayoutStore((s) => s.room);
  const furniture = useLayoutStore(selectVisibleFurniture);
  const { widthM: w, depthM: d, heightM: h } = getRoomShellDimensionsMeters(room);

  return (
    <div className="w-full h-full bg-paper-100 relative">
      <Canvas shadows camera={{ position: [w * 1.1, h * 1.3, d * 1.4], fov: 45 }}>
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

        <RoomShell3D widthM={w} depthM={d} heightM={h} />

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

        <OrbitControls target={[w / 2, h / 3, d / 2]} />
      </Canvas>
    </div>
  );
}
