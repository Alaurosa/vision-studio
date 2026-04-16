import { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text, TransformControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { CATEGORY_COLORS } from '../../utils/constants';
import { getAABB, overlaps, snapToEdge } from '../../utils/collision';
import FurnitureModel from './FurnitureModels';
import SmartFurnitureModel from './SmartFurnitureModel';

const INCH_TO_M = 0.0254;
const M_TO_INCH = 1 / INCH_TO_M;
const GRID_SNAP_M = 6 * INCH_TO_M; // 6 inches in meters

function Floor({ width, depth }) {
  const w = width * INCH_TO_M;
  const d = depth * INCH_TO_M;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, 0, d / 2]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color="#e8e4de" />
    </mesh>
  );
}

function Wall({ start, end, height, thickness = 4 }) {
  const h = height * INCH_TO_M;
  const t = thickness * INCH_TO_M;
  const x1 = start[0] * INCH_TO_M, z1 = start[1] * INCH_TO_M;
  const x2 = end[0] * INCH_TO_M, z2 = end[1] * INCH_TO_M;
  const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
  const angle = Math.atan2(z2 - z1, x2 - x1);

  return (
    <mesh
      position={[(x1 + x2) / 2, h / 2, (z1 + z2) / 2]}
      rotation={[0, -angle, 0]}
      castShadow receiveShadow
    >
      <boxGeometry args={[length, h, t]} />
      <meshStandardMaterial color="#ffffff" />
    </mesh>
  );
}

function RectRoomWalls({ width, depth, height }) {
  const w = width * INCH_TO_M;
  const d = depth * INCH_TO_M;
  const h = height * INCH_TO_M;
  const t = 0.1;

  return (
    <group>
      {/* Back wall */}
      <mesh position={[w / 2, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, t]} />
        <meshStandardMaterial color="#f5f5f0" />
      </mesh>
      {/* Left wall */}
      <mesh position={[0, h / 2, d / 2]} castShadow receiveShadow>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial color="#ededea" />
      </mesh>
      {/* Right wall */}
      <mesh position={[w, h / 2, d / 2]} castShadow receiveShadow>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial color="#ededea" />
      </mesh>
      {/* Front wall (transparent for viewing) */}
      <mesh position={[w / 2, h / 2, d]} receiveShadow>
        <boxGeometry args={[w, h, t]} />
        <meshStandardMaterial color="#f5f5f0" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

function FurniturePiece({ item, isSelected, onSelect }) {
  const w = (item.width || 30) * INCH_TO_M;
  const d = (item.depth || 30) * INCH_TO_M;
  const h = (item.height || 30) * INCH_TO_M;
  const x = (item.x_inches || 0) * INCH_TO_M + w / 2;
  const z = (item.y_inches || 0) * INCH_TO_M + d / 2;
  const color = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.default;
  const rot = ((item.rotation || 0) * Math.PI) / 180;

  return (
    <group
      position={[x, 0, z]}
      rotation={[0, -rot, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <SmartFurnitureModel item={item} w={w} d={d} h={h} color={color} />
      {/* Selection highlight */}
      {isSelected && (
        <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w + 0.06, d + 0.06]} />
          <meshBasicMaterial color="#2563eb" transparent opacity={0.25} />
        </mesh>
      )}
      {/* Hitbox for easier clicking */}
      <mesh position={[0, h / 2, 0]} visible={false}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial />
      </mesh>
      {/* Label floating above */}
      <Text
        position={[0, h + 0.08, 0]}
        rotation={[-Math.PI / 4, 0, 0]}
        fontSize={Math.min(0.1, w * 0.25)}
        color={isSelected ? '#2563eb' : '#555'}
        anchorX="center"
        anchorY="middle"
        maxWidth={w * 1.2}
        fontWeight={isSelected ? 'bold' : 'normal'}
      >
        {item.name || item.category || '?'}
      </Text>
    </group>
  );
}

/* Wraps the selected item with TransformControls for drag-to-move */
function DraggableFurniture({ item, orbitRef, onUpdate, roomWidth, roomDepth, allFurniture }) {
  const groupRef = useRef();
  const transformRef = useRef();
  const [mounted, setMounted] = useState(false);

  // Force re-render after mount so groupRef.current is available for TransformControls
  useEffect(() => { setMounted(true); }, []);

  const w = (item.width || 30) * INCH_TO_M;
  const d = (item.depth || 30) * INCH_TO_M;
  const h = (item.height || 30) * INCH_TO_M;
  const color = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.default;
  const rot = ((item.rotation || 0) * Math.PI) / 180;

  const initialPos = useMemo(() => [
    (item.x_inches || 0) * INCH_TO_M + w / 2,
    0,
    (item.y_inches || 0) * INCH_TO_M + d / 2,
  ], [item.x_inches, item.y_inches, w, d]);

  // Reset position when item moves externally (e.g. undo, chat command)
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(...initialPos);
    }
  }, [initialPos]);

  // Disable orbit while dragging furniture
  useEffect(() => {
    const ctrl = transformRef.current;
    if (!ctrl) return;
    const handleDraggingChanged = (e) => {
      if (e.value) {
        // Drag start
        if (orbitRef.current) orbitRef.current.enabled = false;
      } else {
        // Drag end
        if (orbitRef.current) orbitRef.current.enabled = true;
        if (!groupRef.current) return;
        const pos = groupRef.current.position;
        // Snap to grid
        const snappedX = Math.round(pos.x / GRID_SNAP_M) * GRID_SNAP_M;
        const snappedZ = Math.round(pos.z / GRID_SNAP_M) * GRID_SNAP_M;
        // Clamp within room bounds
        const maxW = roomWidth * INCH_TO_M;
        const maxD = roomDepth * INCH_TO_M;
        let clampedX = Math.max(w / 2, Math.min(snappedX, maxW - w / 2));
        let clampedZ = Math.max(d / 2, Math.min(snappedZ, maxD - d / 2));
        // Convert to inches for collision check
        let xInches = Math.round((clampedX - w / 2) * M_TO_INCH);
        let yInches = Math.round((clampedZ - d / 2) * M_TO_INCH);
        // Snap to edge if overlapping another item
        const candidate = { ...item, x_inches: xInches, y_inches: yInches };
        const candidateBox = getAABB(candidate);
        const hasOverlap = (allFurniture || []).some(other => {
          if (other.id === item.id) return false;
          return overlaps(candidateBox, getAABB(other));
        });
        if (hasOverlap) {
          const room = { width: roomWidth, depth: roomDepth };
          const result = snapToEdge(candidate, allFurniture || [], room);
          xInches = result.x_inches;
          yInches = result.y_inches;
          clampedX = xInches * INCH_TO_M + w / 2;
          clampedZ = yInches * INCH_TO_M + d / 2;
        }
        // Apply clamped position visually
        groupRef.current.position.set(clampedX, 0, clampedZ);
        // Notify parent
        if (xInches !== item.x_inches || yInches !== item.y_inches) {
          onUpdate(item.id, { x_inches: xInches, y_inches: yInches });
        }
      }
    };
    ctrl.addEventListener('dragging-changed', handleDraggingChanged);
    return () => {
      ctrl.removeEventListener('dragging-changed', handleDraggingChanged);
    };
  }, [item.id, item.x_inches, item.y_inches, w, d, roomWidth, roomDepth, onUpdate, orbitRef]);

  // Lock Y axis — only allow XZ movement
  useEffect(() => {
    const ctrl = transformRef.current;
    if (!ctrl) return;
    const onObjectChange = () => {
      if (groupRef.current) {
        groupRef.current.position.y = 0;
      }
    };
    ctrl.addEventListener('objectChange', onObjectChange);
    return () => ctrl.removeEventListener('objectChange', onObjectChange);
  }, []);

  return (
    <>
      <group ref={groupRef} position={initialPos} rotation={[0, -rot, 0]}>
        <SmartFurnitureModel item={item} w={w} d={d} h={h} color={color} />
        {/* Selection highlight */}
        <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w + 0.06, d + 0.06]} />
          <meshBasicMaterial color="#2563eb" transparent opacity={0.25} />
        </mesh>
        {/* Hitbox */}
        <mesh position={[0, h / 2, 0]} visible={false}>
          <boxGeometry args={[w, h, d]} />
          <meshBasicMaterial />
        </mesh>
        <Text
          position={[0, h + 0.08, 0]}
          rotation={[-Math.PI / 4, 0, 0]}
          fontSize={Math.min(0.1, w * 0.25)}
          color="#2563eb"
          anchorX="center"
          anchorY="middle"
          maxWidth={w * 1.2}
          fontWeight="bold"
        >
          {item.name || item.category || '?'}
        </Text>
      </group>
      {mounted && groupRef.current && (
        <TransformControls
          ref={transformRef}
          object={groupRef.current}
          mode="translate"
          showX
          showZ
          showY={false}
          size={0.6}
          space="world"
        />
      )}
    </>
  );
}

/* Keyboard handler for 3D mode — R to rotate, Delete/Backspace to remove, Escape to deselect */
function KeyboardHandler({ selectedId, furniture, onUpdate, onRemove, onDeselect }) {
  const handleKey = useCallback((e) => {
    if (!selectedId) return;
    const item = furniture.find((f) => f.id === selectedId);
    if (!item) return;
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      const newRot = ((item.rotation || 0) + 90) % 360;
      onUpdate(item.id, { rotation: newRot });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onRemove(item.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onDeselect();
    }
  }, [selectedId, furniture, onUpdate, onRemove, onDeselect]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return null;
}

export default function RoomViewer3D({ room, furniture, selectedId, onSelect, onUpdate, onRemove, onDeselect }) {
  const roomWidth = room?.width || 120;
  const roomDepth = room?.depth || 120;
  const roomHeight = room?.height || 96;

  const w = roomWidth * INCH_TO_M;
  const d = roomDepth * INCH_TO_M;
  const orbitRef = useRef();

  const cameraPosition = useMemo(() => {
    const maxDim = Math.max(w, d);
    return [w / 2 + maxDim * 0.6, maxDim * 0.8, d + maxDim * 0.6];
  }, [w, d]);

  const selectedItem = furniture?.find((f) => f.id === selectedId);

  return (
    <div className="w-full h-full bg-gradient-to-b from-slate-800 to-slate-900 rounded-lg overflow-hidden">
      <KeyboardHandler
        selectedId={selectedId}
        furniture={furniture}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onDeselect={onDeselect}
      />
      <Canvas shadows onPointerMissed={() => onDeselect?.()}>
        <PerspectiveCamera makeDefault position={cameraPosition} fov={50} />
        <OrbitControls
          ref={orbitRef}
          target={[w / 2, 0.5, d / 2]}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={1}
          maxDistance={Math.max(w, d) * 3}
        />

        {/* Lighting — soft ambient plus a sunlike key light. */}
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[w, roomHeight * INCH_TO_M * 2, d]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-Math.max(w, d)}
          shadow-camera-right={Math.max(w, d)}
          shadow-camera-top={Math.max(w, d)}
          shadow-camera-bottom={-Math.max(w, d)}
        />
        <directionalLight position={[-w, roomHeight * INCH_TO_M, -d]} intensity={0.25} />
        {/* HDRI environment for realistic PBR reflections on GLB models. */}
        <Environment preset="apartment" />
        {/* Soft ground contact shadow for polish. */}
        <ContactShadows
          position={[w / 2, 0.002, d / 2]}
          scale={Math.max(w, d) * 1.2}
          blur={2.2}
          far={1.5}
          opacity={0.35}
        />

        {/* Room */}
        <Floor width={roomWidth} depth={roomDepth} />
        <RectRoomWalls width={roomWidth} depth={roomDepth} height={roomHeight} />

        {/* Non-selected furniture */}
        {(furniture || []).filter((f) => f.id !== selectedId).map((item) => (
          <FurniturePiece
            key={item.id}
            item={item}
            isSelected={false}
            onSelect={() => onSelect?.(item.id)}
          />
        ))}

        {/* Selected furniture with drag controls */}
        {selectedItem && (
          <DraggableFurniture
            key={selectedItem.id + '-drag'}
            item={selectedItem}
            orbitRef={orbitRef}
            onUpdate={onUpdate}
            roomWidth={roomWidth}
            roomDepth={roomDepth}
            allFurniture={furniture}
          />
        )}
      </Canvas>

      {/* Controls hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
        Click to select · Drag arrows to move · R to rotate · Del to remove · Orbit with left-drag
      </div>

      {/* No dimensions warning */}
      {!room?.width && !room?.depth && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 text-xs text-amber-400 z-10">
          Room dimensions not set — showing default 10'×10' room. Set dimensions in the toolbar.
        </div>
      )}

      {/* Selection info overlay */}
      {selectedItem && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/95 shadow-lg rounded-lg px-4 py-2 flex items-center gap-3 text-sm border border-white/10">
          <span className="font-medium text-white">{selectedItem.name}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">{selectedItem.width}&times;{selectedItem.depth}&quot;</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">{selectedItem.rotation || 0}°</span>
          <button
            onClick={() => onUpdate?.(selectedItem.id, { rotation: ((selectedItem.rotation || 0) + 90) % 360 })}
            className="ml-1 px-2 py-0.5 bg-brand-500 text-white rounded text-xs hover:bg-brand-600"
          >
            Rotate 90°
          </button>
          <button
            onClick={() => onRemove?.(selectedItem.id)}
            className="px-2 py-0.5 bg-red-500 text-white rounded text-xs hover:bg-red-600"
          >
            Remove
          </button>
          <button
            onClick={() => onDeselect?.()}
            className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
