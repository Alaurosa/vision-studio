/**
 * Procedural furniture 3D models built from Three.js primitives.
 * Each category has a recognizable shape — much better than generic boxes,
 * works offline/instantly, and doesn't require external APIs like Meshy.
 *
 * All models are centered on the origin in X/Z and sit on Y=0 (floor).
 * Dimensions are in meters.
 */

import * as THREE from 'three';

// Helper: cushion-looking box with slight rounding via scale/pos.
function Cushion({ w, h, d, x = 0, y = 0, z = 0, color = '#c8a97e', opacity = 1 }) {
  return (
    <mesh castShadow receiveShadow position={[x, y, z]}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.7} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

function Leg({ x, z, h, r = 0.02, color = '#3a2f26' }) {
  return (
    <mesh castShadow position={[x, h / 2, z]}>
      <cylinderGeometry args={[r, r, h, 8]} />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
    </mesh>
  );
}

function Slab({ w, h, d, x = 0, y = 0, z = 0, color = '#8c6444' }) {
  return (
    <mesh castShadow receiveShadow position={[x, y, z]}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.55} />
    </mesh>
  );
}

/* ---- Sofa ---- */
function Sofa({ w, d, h, color = '#c8a97e' }) {
  const seatH = h * 0.45;
  const armW = w * 0.08;
  const armH = h * 0.75;
  const backH = h;
  const cushionCount = 3;
  const seatW = w - armW * 2;
  const cw = seatW / cushionCount;
  return (
    <group>
      {/* Base */}
      <Cushion w={w} h={seatH} d={d} y={seatH / 2} color={color} />
      {/* Back */}
      <Cushion w={w} h={backH - seatH} d={d * 0.22} y={seatH + (backH - seatH) / 2} z={-d / 2 + d * 0.11} color={color} />
      {/* Arms */}
      <Cushion w={armW} h={armH - seatH} d={d} y={seatH + (armH - seatH) / 2} x={-w / 2 + armW / 2} color={color} />
      <Cushion w={armW} h={armH - seatH} d={d} y={seatH + (armH - seatH) / 2} x={w / 2 - armW / 2} color={color} />
      {/* Seat cushions */}
      {Array.from({ length: cushionCount }).map((_, i) => (
        <Cushion
          key={i}
          w={cw * 0.94}
          h={h * 0.12}
          d={d * 0.78}
          x={-seatW / 2 + cw * (i + 0.5)}
          y={seatH + h * 0.06}
          z={d * 0.02}
          color={color}
          opacity={0.95}
        />
      ))}
    </group>
  );
}

/* ---- Armchair / Chair ---- */
function Armchair({ w, d, h, color = '#c7a079' }) {
  return <Sofa w={w} d={d} h={h} color={color} />;
}

function Chair({ w, d, h, color = '#8c6444' }) {
  const seatH = h * 0.5;
  const legH = seatH;
  return (
    <group>
      {/* Seat */}
      <Slab w={w} h={h * 0.06} d={d} y={seatH} color={color} />
      {/* Back */}
      <Slab w={w} h={h * 0.5} d={h * 0.03} y={seatH + h * 0.25} z={-d / 2 + h * 0.015} color={color} />
      {/* Legs */}
      <Leg x={-w / 2 + 0.04} z={-d / 2 + 0.04} h={legH} color="#3a2f26" />
      <Leg x={w / 2 - 0.04} z={-d / 2 + 0.04} h={legH} color="#3a2f26" />
      <Leg x={-w / 2 + 0.04} z={d / 2 - 0.04} h={legH} color="#3a2f26" />
      <Leg x={w / 2 - 0.04} z={d / 2 - 0.04} h={legH} color="#3a2f26" />
    </group>
  );
}

/* ---- Bed ---- */
function Bed({ w, d, h, color = '#a8c4d4' }) {
  const frameH = h * 0.35;
  const mattH = h * 0.3;
  const headH = h;
  return (
    <group>
      {/* Frame */}
      <Slab w={w} h={frameH} d={d} y={frameH / 2} color="#6b5a4a" />
      {/* Mattress */}
      <Cushion w={w * 0.96} h={mattH} d={d * 0.96} y={frameH + mattH / 2} color="#faf7f1" />
      {/* Pillow 1 */}
      <Cushion w={w * 0.4} h={h * 0.07} d={d * 0.22} x={-w * 0.22} y={frameH + mattH + h * 0.035} z={-d * 0.35} color="#ffffff" />
      {/* Pillow 2 */}
      <Cushion w={w * 0.4} h={h * 0.07} d={d * 0.22} x={w * 0.22} y={frameH + mattH + h * 0.035} z={-d * 0.35} color="#ffffff" />
      {/* Headboard */}
      <Slab w={w} h={headH - frameH} d={d * 0.05} y={frameH + (headH - frameH) / 2} z={-d / 2 + d * 0.025} color={color} />
    </group>
  );
}

/* ---- Coffee Table ---- */
function CoffeeTable({ w, d, h, color = '#b89673' }) {
  const topH = h * 0.15;
  const legH = h - topH;
  return (
    <group>
      <Slab w={w} h={topH} d={d} y={h - topH / 2} color={color} />
      <Leg x={-w / 2 + 0.06} z={-d / 2 + 0.06} h={legH} r={0.025} color={color} />
      <Leg x={w / 2 - 0.06} z={-d / 2 + 0.06} h={legH} r={0.025} color={color} />
      <Leg x={-w / 2 + 0.06} z={d / 2 - 0.06} h={legH} r={0.025} color={color} />
      <Leg x={w / 2 - 0.06} z={d / 2 - 0.06} h={legH} r={0.025} color={color} />
    </group>
  );
}

/* ---- Dining Table ---- */
function DiningTable({ w, d, h, color = '#a88560' }) {
  return <CoffeeTable w={w} d={d} h={h} color={color} />;
}

/* ---- Desk ---- */
function Desk({ w, d, h, color = '#b8a46f' }) {
  const topH = h * 0.08;
  const legH = h - topH;
  return (
    <group>
      <Slab w={w} h={topH} d={d} y={h - topH / 2} color={color} />
      {/* Side panels instead of legs for desk */}
      <Slab w={w * 0.04} h={legH} d={d * 0.9} y={legH / 2} x={-w / 2 + w * 0.02} color={color} />
      <Slab w={w * 0.04} h={legH} d={d * 0.9} y={legH / 2} x={w / 2 - w * 0.02} color={color} />
    </group>
  );
}

/* ---- Bookshelf ---- */
function Bookshelf({ w, d, h, color = '#7e5230' }) {
  const shelfCount = 5;
  const shelfH = 0.02;
  const gap = (h - shelfH * shelfCount) / (shelfCount - 1);
  return (
    <group>
      {/* Back panel */}
      <Slab w={w * 0.98} h={h} d={0.02} y={h / 2} z={-d / 2 + 0.01} color={color} />
      {/* Side panels */}
      <Slab w={0.02} h={h} d={d} y={h / 2} x={-w / 2 + 0.01} color={color} />
      <Slab w={0.02} h={h} d={d} y={h / 2} x={w / 2 - 0.01} color={color} />
      {/* Shelves */}
      {Array.from({ length: shelfCount }).map((_, i) => (
        <Slab
          key={i}
          w={w - 0.04}
          h={shelfH}
          d={d * 0.96}
          y={shelfH / 2 + i * (shelfH + gap)}
          color={color}
        />
      ))}
    </group>
  );
}

/* ---- Dresser ---- */
function Dresser({ w, d, h, color = '#a89079' }) {
  const drawerCount = 3;
  const drawerH = (h - 0.04) / drawerCount;
  return (
    <group>
      {/* Body */}
      <Slab w={w} h={h} d={d} y={h / 2} color={color} />
      {/* Drawer faces */}
      {Array.from({ length: drawerCount }).map((_, i) => (
        <group key={i}>
          <Slab
            w={w * 0.94}
            h={drawerH * 0.88}
            d={0.01}
            y={0.02 + i * drawerH + drawerH / 2}
            z={d / 2 + 0.005}
            color="#8a7664"
          />
          {/* Handle */}
          <mesh position={[0, 0.02 + i * drawerH + drawerH / 2, d / 2 + 0.015]}>
            <boxGeometry args={[w * 0.15, 0.015, 0.02]} />
            <meshStandardMaterial color="#2c2520" roughness={0.4} metalness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---- Nightstand ---- */
function Nightstand({ w, d, h, color = '#b8a08f' }) {
  return <Dresser w={w} d={d} h={h} color={color} />;
}

/* ---- TV Stand ---- */
function TVStand({ w, d, h, color = '#6d6e6e' }) {
  return (
    <group>
      <Slab w={w} h={h * 0.92} d={d} y={h / 2} color={color} />
      {/* TV */}
      <Slab w={w * 0.7} h={h * 1.2} d={0.04} y={h + h * 0.6} z={-d / 2 + 0.04} color="#1a1a1a" />
      <Slab w={w * 0.68} h={h * 1.15} d={0.01} y={h + h * 0.6} z={-d / 2 + 0.06} color="#0a0a0a" />
    </group>
  );
}

/* ---- Cabinet ---- */
function Cabinet({ w, d, h, color = '#927b66' }) {
  return (
    <group>
      <Slab w={w} h={h} d={d} y={h / 2} color={color} />
      {/* Door split */}
      <Slab w={0.01} h={h * 0.96} d={0.005} y={h / 2} z={d / 2 + 0.003} color="#3a2f26" />
      {/* Handles */}
      <mesh position={[-w * 0.1, h / 2, d / 2 + 0.015]}>
        <boxGeometry args={[0.015, h * 0.08, 0.02]} />
        <meshStandardMaterial color="#2c2520" metalness={0.5} />
      </mesh>
      <mesh position={[w * 0.1, h / 2, d / 2 + 0.015]}>
        <boxGeometry args={[0.015, h * 0.08, 0.02]} />
        <meshStandardMaterial color="#2c2520" metalness={0.5} />
      </mesh>
    </group>
  );
}

/* ---- Loveseat (smaller sofa, 2 cushions) ---- */
function Loveseat({ w, d, h, color = '#d4b48c' }) {
  return <Sofa w={w} d={d} h={h} color={color} />;
}

/* ---- Floor lamp (starter "lighting" category) ---- */
function Lamp({ w, d, h, color = '#c8b87a' }) {
  const baseH = Math.max(h * 0.08, 0.04);
  const poleH = h - baseH - h * 0.22;
  const shadeH = h * 0.22;
  const poleR = Math.min(w, d) * 0.06;
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, baseH / 2, 0]}>
        <cylinderGeometry args={[w * 0.2, w * 0.22, baseH, 12]} />
        <meshStandardMaterial color="#3a2f26" roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh castShadow position={[0, baseH + poleH / 2, 0]}>
        <cylinderGeometry args={[poleR, poleR, poleH, 8]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, baseH + poleH + shadeH / 2, 0]}>
        <cylinderGeometry args={[w * 0.28, w * 0.32, shadeH, 16, 1, true]} />
        <meshStandardMaterial color={color} roughness={0.65} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ---- Decor / rug (starter "decor" category) ---- */
function Decor({ w, d, h, color = '#9c8b7a' }) {
  const profileH = Math.max(h, 0.02);
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, profileH / 2, 0]}>
        <boxGeometry args={[w, profileH, d]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    </group>
  );
}

const CATEGORY_MAP = {
  sofa: Sofa,
  loveseat: Loveseat,
  armchair: Armchair,
  chair: Chair,
  bed: Bed,
  coffee_table: CoffeeTable,
  dining_table: DiningTable,
  desk: Desk,
  bookshelf: Bookshelf,
  dresser: Dresser,
  nightstand: Nightstand,
  tv_stand: TVStand,
  cabinet: Cabinet,
  lamp: Lamp,
  floor_lamp: Lamp,
  decor: Decor,
  rug: Decor,
};

/**
 * Renders a procedural 3D model for the given furniture category.
 * Falls back to a simple box if no category-specific model exists.
 *
 * Props:
 *   category — 'sofa' | 'bed' | 'desk' | ...
 *   w, d, h  — width, depth, height in meters
 *   color    — base fill color (hex)
 */
export default function ProceduralFurniture({ category, w, d, h, color = '#c8a97e' }) {
  const Model = CATEGORY_MAP[category];
  if (Model) return <Model w={w} d={d} h={h} color={color} />;
  // Fallback: plain box
  return (
    <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}
