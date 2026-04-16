/**
 * Procedural 3D furniture models for each category.
 * Each model is built from Three.js primitives to look recognizable
 * and scales to match the item's real dimensions (in meters).
 */
import { useMemo } from 'react';
import * as THREE from 'three';

const LEG_RADIUS = 0.015;
const LEG_COLOR = '#5c4033';
const METAL_COLOR = '#707070';

// Simple seeded pseudo-random for deterministic book sizes
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function Leg({ position, height, radius = LEG_RADIUS, color = LEG_COLOR }) {
  return (
    <mesh position={position} castShadow>
      <cylinderGeometry args={[radius, radius, height, 8]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function FourLegs({ w, d, h, inset = 0.03, radius = LEG_RADIUS, color = LEG_COLOR }) {
  const y = h / 2;
  return (
    <group>
      <Leg position={[-w/2 + inset, y, -d/2 + inset]} height={h} radius={radius} color={color} />
      <Leg position={[w/2 - inset, y, -d/2 + inset]} height={h} radius={radius} color={color} />
      <Leg position={[-w/2 + inset, y, d/2 - inset]} height={h} radius={radius} color={color} />
      <Leg position={[w/2 - inset, y, d/2 - inset]} height={h} radius={radius} color={color} />
    </group>
  );
}

/* ─── SOFA ─────────────────────────────── */
export function SofaModel({ w, d, h, color }) {
  const seatH = h * 0.38;
  const backH = h * 0.55;
  const armW = d * 0.15;
  const legH = h * 0.07;
  const cushionColor = new THREE.Color(color).offsetHSL(0, 0, 0.05).getStyle();
  return (
    <group>
      {/* Legs */}
      <FourLegs w={w} d={d} h={legH} inset={0.04} />
      {/* Seat base */}
      <mesh position={[0, legH + seatH/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, seatH, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Seat cushions */}
      {[...Array(Math.max(1, Math.round(w / 0.6)))].map((_, i, arr) => {
        const cw = (w - armW * 2 - 0.01 * (arr.length - 1)) / arr.length;
        const cx = -w/2 + armW + cw/2 + i * (cw + 0.01);
        return (
          <mesh key={`sc${i}`} position={[cx, legH + seatH + 0.03, 0.02]} castShadow>
            <boxGeometry args={[cw * 0.95, 0.06, d * 0.65]} />
            <meshStandardMaterial color={cushionColor} />
          </mesh>
        );
      })}
      {/* Back */}
      <mesh position={[0, legH + seatH + backH/2, -d/2 + 0.05]} castShadow receiveShadow>
        <boxGeometry args={[w, backH, 0.1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Back cushions */}
      {[...Array(Math.max(1, Math.round(w / 0.6)))].map((_, i, arr) => {
        const cw = (w - armW * 2 - 0.01 * (arr.length - 1)) / arr.length;
        const cx = -w/2 + armW + cw/2 + i * (cw + 0.01);
        return (
          <mesh key={`bc${i}`} position={[cx, legH + seatH + backH * 0.4, -d/2 + 0.12]} castShadow>
            <boxGeometry args={[cw * 0.9, backH * 0.7, 0.08]} />
            <meshStandardMaterial color={cushionColor} />
          </mesh>
        );
      })}
      {/* Left arm */}
      <mesh position={[-w/2 + armW/2, legH + seatH + backH * 0.3, 0]} castShadow>
        <boxGeometry args={[armW, backH * 0.6, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Right arm */}
      <mesh position={[w/2 - armW/2, legH + seatH + backH * 0.3, 0]} castShadow>
        <boxGeometry args={[armW, backH * 0.6, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

/* ─── BED ──────────────────────────────── */
export function BedModel({ w, d, h, color }) {
  const frameH = h * 0.2;
  const mattressH = h * 0.25;
  const headboardH = h * 0.65;
  const legH = h * 0.1;
  return (
    <group>
      {/* Legs */}
      <FourLegs w={w} d={d} h={legH} inset={0.02} />
      {/* Bed frame */}
      <mesh position={[0, legH + frameH/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, frameH, d]} />
        <meshStandardMaterial color={LEG_COLOR} />
      </mesh>
      {/* Mattress */}
      <mesh position={[0, legH + frameH + mattressH/2, 0.02]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.96, mattressH, d * 0.95]} />
        <meshStandardMaterial color="#f0f0f0" />
      </mesh>
      {/* Sheets/comforter */}
      <mesh position={[0, legH + frameH + mattressH + 0.02, d * 0.08]} castShadow>
        <boxGeometry args={[w * 0.92, 0.04, d * 0.75]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Pillow(s) */}
      {[...Array(Math.max(1, Math.round(w / 0.5)))].map((_, i, arr) => {
        const pw = Math.min(0.45, (w * 0.9) / arr.length);
        const px = -w/2 + w/(arr.length + 1) * (i + 1);
        return (
          <mesh key={`p${i}`} position={[px, legH + frameH + mattressH + 0.06, -d/2 + 0.18]} castShadow>
            <boxGeometry args={[pw, 0.08, 0.25]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        );
      })}
      {/* Headboard */}
      <mesh position={[0, legH + headboardH/2, -d/2 + 0.025]} castShadow receiveShadow>
        <boxGeometry args={[w, headboardH, 0.05]} />
        <meshStandardMaterial color={LEG_COLOR} />
      </mesh>
    </group>
  );
}

/* ─── DESK ─────────────────────────────── */
export function DeskModel({ w, d, h, color }) {
  const topH = 0.03;
  const legH = h - topH;
  return (
    <group>
      {/* Desktop surface */}
      <mesh position={[0, legH + topH/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, topH, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Legs */}
      <FourLegs w={w} d={d} h={legH} inset={0.03} color={METAL_COLOR} />
      {/* Under-desk panel (modesty panel) */}
      <mesh position={[0, legH * 0.45, -d/2 + 0.015]} castShadow>
        <boxGeometry args={[w * 0.96, legH * 0.6, 0.02]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Drawer unit (right side) */}
      <mesh position={[w/2 - w*0.18, legH * 0.45, 0]} castShadow>
        <boxGeometry args={[w * 0.3, legH * 0.7, d * 0.9]} />
        <meshStandardMaterial color={new THREE.Color(color).offsetHSL(0, 0, -0.05).getStyle()} />
      </mesh>
      {/* Drawer handles */}
      {[0.25, 0.50, 0.75].map((frac, i) => (
        <mesh key={i} position={[w/2 - w*0.18, legH * frac, d/2 * 0.45 + 0.015]} castShadow>
          <boxGeometry args={[0.06, 0.008, 0.008]} />
          <meshStandardMaterial color={METAL_COLOR} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/* ─── BOOKSHELF ────────────────────────── */
export function BookshelfModel({ w, d, h, color }) {
  const boardT = 0.02;
  const numShelves = Math.max(2, Math.round(h / 0.35));
  const shelfSpacing = (h - boardT) / numShelves;
  const shelfColors = ['#8b4513', '#a0522d', '#cd853f', '#deb887', '#4a6741', '#2f4f4f', '#8b0000'];
  return (
    <group>
      {/* Left side */}
      <mesh position={[-w/2 + boardT/2, h/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[boardT, h, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Right side */}
      <mesh position={[w/2 - boardT/2, h/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[boardT, h, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Back panel */}
      <mesh position={[0, h/2, -d/2 + 0.005]} castShadow>
        <boxGeometry args={[w, h, 0.01]} />
        <meshStandardMaterial color={new THREE.Color(color).offsetHSL(0, 0, -0.1).getStyle()} />
      </mesh>
      {/* Shelves */}
      {[...Array(numShelves + 1)].map((_, i) => (
        <mesh key={`shelf${i}`} position={[0, i * shelfSpacing + boardT/2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w - boardT * 2, boardT, d]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      {/* Books on shelves */}
      {[...Array(numShelves)].map((_, si) => {
        const shelfY = si * shelfSpacing + boardT;
        const bookH = shelfSpacing * 0.75;
        const numBooks = Math.max(3, Math.floor((w - boardT * 4) / 0.04));
        const rand = seededRandom(si * 1000 + 42);
        return [...Array(numBooks)].map((_, bi) => {
          const bw = 0.02 + rand() * 0.02;
          const bh = bookH * (0.6 + rand() * 0.4);
          const bx = -w/2 + boardT * 2 + bi * (bw + 0.003);
          if (bx + bw > w/2 - boardT * 2) return null;
          return (
            <mesh key={`b${si}-${bi}`} position={[bx + bw/2, shelfY + bh/2, 0]}>
              <boxGeometry args={[bw, bh, d * 0.7]} />
              <meshStandardMaterial color={shelfColors[(si * 7 + bi * 3) % shelfColors.length]} />
            </mesh>
          );
        });
      })}
    </group>
  );
}

/* ─── DINING TABLE ─────────────────────── */
export function DiningTableModel({ w, d, h, color }) {
  const topH = 0.035;
  const legH = h - topH;
  return (
    <group>
      {/* Tabletop */}
      <mesh position={[0, legH + topH/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, topH, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Legs */}
      <FourLegs w={w} d={d} h={legH} inset={0.06} radius={0.025} color={color} />
      {/* Apron (rail under tabletop) */}
      <mesh position={[0, legH - 0.03, -d/2 + 0.04]} castShadow>
        <boxGeometry args={[w * 0.9, 0.06, 0.02]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, legH - 0.03, d/2 - 0.04]} castShadow>
        <boxGeometry args={[w * 0.9, 0.06, 0.02]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-w/2 + 0.06, legH - 0.03, 0]} castShadow>
        <boxGeometry args={[0.02, 0.06, d * 0.85]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[w/2 - 0.06, legH - 0.03, 0]} castShadow>
        <boxGeometry args={[0.02, 0.06, d * 0.85]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

/* ─── COFFEE TABLE ─────────────────────── */
export function CoffeeTableModel({ w, d, h, color }) {
  const topH = 0.025;
  const legH = h - topH;
  return (
    <group>
      {/* Tabletop */}
      <mesh position={[0, legH + topH/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, topH, d]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* Legs */}
      <FourLegs w={w} d={d} h={legH} inset={0.04} radius={0.012} color={METAL_COLOR} />
      {/* Lower shelf */}
      <mesh position={[0, legH * 0.3, 0]} castShadow>
        <boxGeometry args={[w * 0.85, 0.015, d * 0.85]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

/* ─── DRESSER ──────────────────────────── */
export function DresserModel({ w, d, h, color }) {
  const legH = 0.04;
  const bodyH = h - legH;
  const numDrawers = Math.max(2, Math.round(bodyH / 0.18));
  const drawerH = (bodyH - 0.02) / numDrawers;
  return (
    <group>
      {/* Legs */}
      <FourLegs w={w} d={d} h={legH} inset={0.02} />
      {/* Body */}
      <mesh position={[0, legH + bodyH/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, bodyH, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Drawers */}
      {[...Array(numDrawers)].map((_, i) => {
        const dy = legH + 0.01 + i * drawerH + drawerH/2;
        return (
          <group key={i}>
            {/* Drawer front face (slightly lighter) */}
            <mesh position={[0, dy, d/2 - 0.005]} castShadow>
              <boxGeometry args={[w * 0.92, drawerH * 0.85, 0.015]} />
              <meshStandardMaterial color={new THREE.Color(color).offsetHSL(0, 0, 0.08).getStyle()} />
            </mesh>
            {/* Handle */}
            <mesh position={[0, dy, d/2 + 0.008]}>
              <boxGeometry args={[w * 0.15, 0.01, 0.01]} />
              <meshStandardMaterial color={METAL_COLOR} metalness={0.7} roughness={0.2} />
            </mesh>
          </group>
        );
      })}
      {/* Top surface */}
      <mesh position={[0, legH + bodyH + 0.005, 0]} castShadow>
        <boxGeometry args={[w + 0.01, 0.015, d + 0.01]} />
        <meshStandardMaterial color={new THREE.Color(color).offsetHSL(0, 0, -0.05).getStyle()} />
      </mesh>
    </group>
  );
}

/* ─── NIGHTSTAND ───────────────────────── */
export function NightstandModel({ w, d, h, color }) {
  const legH = 0.04;
  const bodyH = h - legH;
  return (
    <group>
      <FourLegs w={w} d={d} h={legH} inset={0.02} radius={0.01} />
      {/* Body */}
      <mesh position={[0, legH + bodyH/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, bodyH, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Top */}
      <mesh position={[0, h + 0.005, 0]} castShadow>
        <boxGeometry args={[w + 0.005, 0.012, d + 0.005]} />
        <meshStandardMaterial color={new THREE.Color(color).offsetHSL(0, 0, -0.05).getStyle()} />
      </mesh>
      {/* Drawer */}
      <mesh position={[0, legH + bodyH * 0.7, d/2 - 0.003]} castShadow>
        <boxGeometry args={[w * 0.88, bodyH * 0.35, 0.01]} />
        <meshStandardMaterial color={new THREE.Color(color).offsetHSL(0, 0, 0.08).getStyle()} />
      </mesh>
      {/* Handle */}
      <mesh position={[0, legH + bodyH * 0.7, d/2 + 0.008]}>
        <boxGeometry args={[0.04, 0.008, 0.008]} />
        <meshStandardMaterial color={METAL_COLOR} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Open shelf */}
      <mesh position={[0, legH + bodyH * 0.25, 0]} castShadow>
        <boxGeometry args={[w * 0.92, 0.012, d * 0.92]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

/* ─── ARMCHAIR ─────────────────────────── */
export function ArmchairModel({ w, d, h, color }) {
  const seatH = h * 0.38;
  const backH = h * 0.55;
  const armW = w * 0.15;
  const legH = h * 0.07;
  const cushionColor = new THREE.Color(color).offsetHSL(0, 0, 0.05).getStyle();
  return (
    <group>
      <FourLegs w={w} d={d} h={legH} inset={0.03} />
      {/* Seat */}
      <mesh position={[0, legH + seatH/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, seatH, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Seat cushion */}
      <mesh position={[0, legH + seatH + 0.03, 0.02]} castShadow>
        <boxGeometry args={[w * 0.75, 0.06, d * 0.7]} />
        <meshStandardMaterial color={cushionColor} />
      </mesh>
      {/* Back */}
      <mesh position={[0, legH + seatH + backH/2, -d/2 + 0.05]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.85, backH, 0.1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Back cushion */}
      <mesh position={[0, legH + seatH + backH * 0.4, -d/2 + 0.12]} castShadow>
        <boxGeometry args={[w * 0.7, backH * 0.7, 0.08]} />
        <meshStandardMaterial color={cushionColor} />
      </mesh>
      {/* Left arm */}
      <mesh position={[-w/2 + armW/2, legH + seatH + backH * 0.25, 0]} castShadow>
        <boxGeometry args={[armW, backH * 0.5, d * 0.9]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Right arm */}
      <mesh position={[w/2 - armW/2, legH + seatH + backH * 0.25, 0]} castShadow>
        <boxGeometry args={[armW, backH * 0.5, d * 0.9]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

/* ─── TV STAND ─────────────────────────── */
export function TVStandModel({ w, d, h, color }) {
  const legH = 0.03;
  const bodyH = h - legH;
  const numCompartments = Math.max(2, Math.round(w / 0.4));
  return (
    <group>
      <FourLegs w={w} d={d} h={legH} inset={0.03} radius={0.01} color={METAL_COLOR} />
      {/* Body */}
      <mesh position={[0, legH + bodyH/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, bodyH, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Top surface */}
      <mesh position={[0, h + 0.005, 0]} castShadow>
        <boxGeometry args={[w + 0.005, 0.012, d + 0.005]} />
        <meshStandardMaterial color={new THREE.Color(color).offsetHSL(0, 0, -0.05).getStyle()} />
      </mesh>
      {/* Compartment doors */}
      {[...Array(numCompartments)].map((_, i) => {
        const cw = (w * 0.92) / numCompartments;
        const cx = -w/2 * 0.92 + cw/2 + i * cw;
        return (
          <group key={i}>
            <mesh position={[cx, legH + bodyH/2, d/2 - 0.003]} castShadow>
              <boxGeometry args={[cw * 0.9, bodyH * 0.85, 0.01]} />
              <meshStandardMaterial color={new THREE.Color(color).offsetHSL(0, 0, 0.06).getStyle()} />
            </mesh>
            {/* Small handle */}
            <mesh position={[cx, legH + bodyH/2, d/2 + 0.006]}>
              <sphereGeometry args={[0.008, 8, 8]} />
              <meshStandardMaterial color={METAL_COLOR} metalness={0.7} roughness={0.2} />
            </mesh>
          </group>
        );
      })}
      {/* TV placeholder on top */}
      <mesh position={[0, h + 0.28, -d*0.15]} castShadow>
        <boxGeometry args={[w * 0.85, 0.5, 0.02]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* TV screen */}
      <mesh position={[0, h + 0.28, -d*0.15 + 0.011]}>
        <boxGeometry args={[w * 0.82, 0.47, 0.001]} />
        <meshStandardMaterial color="#222233" emissive="#111122" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

/* ─── CABINET (generic) ────────────────── */
export function CabinetModel({ w, d, h, color }) {
  return (
    <group>
      {/* Body */}
      <mesh position={[0, h/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Top */}
      <mesh position={[0, h + 0.005, 0]} castShadow>
        <boxGeometry args={[w + 0.005, 0.012, d + 0.005]} />
        <meshStandardMaterial color={new THREE.Color(color).offsetHSL(0, 0, -0.05).getStyle()} />
      </mesh>
      {/* Double doors */}
      <mesh position={[-w/4, h/2, d/2 - 0.003]} castShadow>
        <boxGeometry args={[w * 0.45, h * 0.9, 0.01]} />
        <meshStandardMaterial color={new THREE.Color(color).offsetHSL(0, 0, 0.06).getStyle()} />
      </mesh>
      <mesh position={[w/4, h/2, d/2 - 0.003]} castShadow>
        <boxGeometry args={[w * 0.45, h * 0.9, 0.01]} />
        <meshStandardMaterial color={new THREE.Color(color).offsetHSL(0, 0, 0.06).getStyle()} />
      </mesh>
      {/* Door handles */}
      <mesh position={[-0.02, h/2, d/2 + 0.008]}>
        <boxGeometry args={[0.008, 0.06, 0.008]} />
        <meshStandardMaterial color={METAL_COLOR} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.02, h/2, d/2 + 0.008]}>
        <boxGeometry args={[0.008, 0.06, 0.008]} />
        <meshStandardMaterial color={METAL_COLOR} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

/* ─── MODEL SELECTOR ───────────────────── */
const MODEL_MAP = {
  sofa: SofaModel,
  loveseat: SofaModel,
  bed: BedModel,
  desk: DeskModel,
  bookshelf: BookshelfModel,
  bookcase: BookshelfModel,
  dining_table: DiningTableModel,
  coffee_table: CoffeeTableModel,
  dresser: DresserModel,
  nightstand: NightstandModel,
  armchair: ArmchairModel,
  tv_stand: TVStandModel,
  cabinet: CabinetModel,
};

export default function FurnitureModel({ category, w, d, h, color }) {
  const Component = MODEL_MAP[category] || CabinetModel;
  return <Component w={w} d={d} h={h} color={color} />;
}
