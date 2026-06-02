import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CATEGORY_COLORS } from '@/utils/constants';
import {
  clamp,
  minimapProjection,
  worldToMinimap,
  furnitureFootprintCorners,
  cameraFacingRad,
  roomDimensionsMeters,
} from '@/utils/cameraNav';

export const MINIMAP_WIDTH = 172;
export const MINIMAP_HEIGHT = 136;
const MINIMAP_PADDING = 12;

/**
 * Imperatively redraw the top-down minimap onto its 2D canvas. Kept out of the
 * React render path (called from a useFrame tick) so it never re-renders the
 * tree. All world→pixel math comes from the unit-tested cameraNav helpers.
 */
function drawMinimap(canvas, { room, furniture, cameraX, cameraZ, headingRad }) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  if (canvas.width !== MINIMAP_WIDTH * dpr || canvas.height !== MINIMAP_HEIGHT * dpr) {
    canvas.width = MINIMAP_WIDTH * dpr;
    canvas.height = MINIMAP_HEIGHT * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

  const proj = minimapProjection(room, {
    width: MINIMAP_WIDTH,
    height: MINIMAP_HEIGHT,
    padding: MINIMAP_PADDING,
  });

  // Room floor
  ctx.fillStyle = 'rgba(248,245,236,0.96)';
  ctx.fillRect(proj.originX, proj.originY, proj.roomPxW, proj.roomPxH);
  ctx.strokeStyle = '#a89370';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(proj.originX, proj.originY, proj.roomPxW, proj.roomPxH);

  // Furniture footprints (true rotated rectangles)
  for (const item of furniture || []) {
    const corners = furnitureFootprintCorners(item).map((c) =>
      worldToMinimap(c.x, c.z, proj),
    );
    if (corners.length < 3) continue;
    ctx.beginPath();
    corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = item.color || CATEGORY_COLORS[item.category] || CATEGORY_COLORS.default;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(16,15,13,0.35)';
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  // Camera marker + view cone — clamped to the panel so it stays visible even
  // when the camera orbits outside the room (the dollhouse view).
  const cam = worldToMinimap(cameraX, cameraZ, proj);
  const mx = clamp(cam.x, 5, MINIMAP_WIDTH - 5);
  const my = clamp(cam.y, 5, MINIMAP_HEIGHT - 5);
  const coneLength = 18;
  const coneHalfAngle = 0.42;

  ctx.fillStyle = 'rgba(59,130,246,0.22)';
  ctx.beginPath();
  ctx.moveTo(mx, my);
  ctx.lineTo(
    mx + Math.cos(headingRad - coneHalfAngle) * coneLength,
    my + Math.sin(headingRad - coneHalfAngle) * coneLength,
  );
  ctx.lineTo(
    mx + Math.cos(headingRad + coneHalfAngle) * coneLength,
    my + Math.sin(headingRad + coneHalfAngle) * coneLength,
  );
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(mx, my, 3.4, 0, Math.PI * 2);
  ctx.fillStyle = '#3b82f6';
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
}

/**
 * In-canvas driver (Sprint 4, US3 · 3.3). Reads the live camera pose each frame
 * and redraws the minimap canvas. Renders nothing into the 3D scene.
 * Throttled to ~20 fps — the 2D overlay doesn't need full frame-rate.
 */
export function MinimapTracker({ room, furniture, canvasRef, enabled = true }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  const lastDraw = useRef(0);

  useFrame((state) => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const now = state.clock.elapsedTime;
    if (now - lastDraw.current < 0.05) return;
    lastDraw.current = now;

    const { w, d, h } = roomDimensionsMeters(room);
    const target = controls?.target ?? { x: w / 2, y: h / 3, z: d / 2 };
    const headingRad = cameraFacingRad(camera.position, target);

    drawMinimap(canvas, {
      room,
      furniture,
      cameraX: camera.position.x,
      cameraZ: camera.position.z,
      headingRad,
    });
  });

  return null;
}

/**
 * Styled HTML panel that hosts the minimap canvas (rendered outside the R3F
 * Canvas). The parent owns `canvasRef` (shared with {@link MinimapTracker}) and
 * the show/hide state.
 */
export function MinimapPanel({ canvasRef }) {
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-10 select-none">
      <div className="rounded-lg border border-[#a89370]/60 bg-paper-100/90 p-1.5 shadow-md backdrop-blur-sm">
        <div className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-ink-500">
          Map
        </div>
        <canvas
          ref={canvasRef}
          style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
          className="block rounded"
        />
      </div>
    </div>
  );
}
