import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { useLayoutStore } from '@/store/layoutStore';
import { CATEGORY_COLORS } from '@/utils/constants';
import { getRotatedBoundingBox } from '@/utils/scale';
import SmartFurnitureModel from './SmartFurnitureModel';

// Inches → meters
const IN_TO_M = 0.0254;

export default function RoomViewer3D() {
  const { room, furniture } = useLayoutStore();
  const w = (room?.width || 180) * IN_TO_M;
  const d = (room?.depth || 144) * IN_TO_M;
  const h = (room?.height || 96) * IN_TO_M;

  return (
    <div className="w-full h-full bg-paper-100">
      <Canvas shadows camera={{ position: [w * 1.1, h * 1.3, d * 1.4], fov: 45 }}>
        <color attach="background" args={['#f4efe4']} />
        <ambientLight intensity={0.55} />
        <directionalLight
          castShadow
          position={[w, h * 2, d * 1.5]}
          intensity={1.1}
          shadow-mapSize={[2048, 2048]}
        />
        <Environment preset="apartment" />

        {/* Floor */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, 0, d / 2]}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color="#ebe3d1" roughness={0.85} />
        </mesh>

        {/* Walls */}
        <mesh position={[w / 2, h / 2, 0]} receiveShadow>
          <boxGeometry args={[w, h, 0.06]} />
          <meshStandardMaterial color="#faf7f1" />
        </mesh>
        <mesh position={[w / 2, h / 2, d]} receiveShadow>
          <boxGeometry args={[w, h, 0.06]} />
          <meshStandardMaterial color="#faf7f1" />
        </mesh>
        <mesh position={[0, h / 2, d / 2]} receiveShadow>
          <boxGeometry args={[0.06, h, d]} />
          <meshStandardMaterial color="#faf7f1" />
        </mesh>
        <mesh position={[w, h / 2, d / 2]} receiveShadow>
          <boxGeometry args={[0.06, h, d]} />
          <meshStandardMaterial color="#faf7f1" />
        </mesh>

        {/* Furniture */}
        {furniture.map((it) => {
          const fw = it.width * IN_TO_M;
          const fd = it.depth * IN_TO_M;
          const fh = (it.height || 30) * IN_TO_M;
          const bbox = getRotatedBoundingBox(it.width || 0, it.depth || 0, it.rotation || 0);
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
