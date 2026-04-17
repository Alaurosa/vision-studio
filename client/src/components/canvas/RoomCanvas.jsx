import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KImage, Rect, Group, Text, Line } from 'react-konva';
import useImage from 'use-image';
import { useLayoutStore } from '@/store/layoutStore';
import { computeRotation } from '@/utils/scale';
import FurnitureItem from './FurnitureItem';
import GridOverlay from './GridOverlay';
import WallOutline from './WallOutline';

export default function RoomCanvas() {
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [placementWarning, setPlacementWarning] = useState('');

  const {
    room, furniture, selectedId, detections, zones, activeZoneId, gridEnabled,
    selectFurniture, clearSelection, updateFurniture, removeFurniture, setActiveZone,
  } = useLayoutStore();

  // Resize observer
  useEffect(() => {
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(() => {
      const r = wrapRef.current.getBoundingClientRect();
      setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, []);

  // Compute scale so the room fills the canvas with margin
  const margin = 48;
  const pxPerInchFit = room?.width && room?.depth
    ? Math.min((size.w - margin * 2) / room.width, (size.h - margin * 2) / room.depth)
    : 4;
  const pxPerInch = pxPerInchFit > 0 ? pxPerInchFit : 4;

  const [bgImage] = useImage(room?.floor_plan_url || room?.room_photo_url || '', 'anonymous');

  const onWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const scaleBy = 1.06;
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(0.3, Math.min(5, direction > 0 ? oldScale * scaleBy : oldScale / scaleBy));
    setViewport({
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const onKeyDown = (e) => {
    const { selectedId, furniture, removeFurniture, updateFurniture, clearSelection } = useLayoutStore.getState();
    if (!selectedId) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeFurniture(selectedId);
    } else if (e.key === 'r' || e.key === 'R') {
      const item = furniture.find((f) => f.id === selectedId);
      if (item) {
        const patch = computeRotation(item, (item.rotation || 0) + 15);
        updateFurniture(item.id, patch);
      }
    } else if (e.key === 'Escape') {
      clearSelection();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const roomPxW = (room?.width || 0) * pxPerInch;
  const roomPxH = (room?.depth || 0) * pxPerInch;
  const roomOffsetX = Math.max(margin, (size.w - roomPxW) / 2);
  const roomOffsetY = Math.max(margin, (size.h - roomPxH) / 2);

  const showPlacementWarning = (message) => {
    setPlacementWarning(message);
    window.clearTimeout(showPlacementWarning.timeoutId);
    showPlacementWarning.timeoutId = window.setTimeout(() => setPlacementWarning(''), 2200);
  };

  return (
    <div ref={wrapRef} className="relative w-full h-full bg-paper-100" style={{ touchAction: 'none', userSelect: 'none' }}>
      {/* Corner metadata */}
      <div className="absolute top-4 left-4 eyebrow text-ink-500 z-10 pointer-events-none">
        {room?.width ? `${room.width}" × ${room.depth}"` : 'Untitled canvas'}
      </div>
      <div className="absolute bottom-4 right-4 eyebrow text-ink-500 z-10 pointer-events-none">
        Zoom {(viewport.scale * 100).toFixed(0)}%
      </div>
      {placementWarning && (
        <div className="absolute top-4 right-4 z-10 rounded-md border border-red-300 bg-white/95 px-3 py-2 text-[11px] uppercase tracking-editorial text-red-600 shadow-sm">
          {placementWarning}
        </div>
      )}

      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        draggable
        onWheel={onWheel}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        onDragEnd={(e) => {
          // Only update viewport when Stage itself is dragged, not furniture
          if (e.target !== stageRef.current) return;
          setViewport((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
        }}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) clearSelection();
        }}
      >
        {/* Background image */}
        <Layer listening={false}>
          {bgImage && room?.width && (
            <KImage
              image={bgImage}
              x={roomOffsetX} y={roomOffsetY}
              width={roomPxW} height={roomPxH}
              opacity={0.28}
            />
          )}
          {/* Room floor */}
          {room?.width && (
            <Rect
              x={roomOffsetX} y={roomOffsetY}
              width={roomPxW} height={roomPxH}
              fill="#faf7f1"
              stroke="#100f0d"
              strokeWidth={2 / viewport.scale}
            />
          )}
        </Layer>

        {/* Grid */}
        <Layer listening={false}>
          {gridEnabled && room?.width && (
            <GridOverlay
              originX={roomOffsetX}
              originY={roomOffsetY}
              width={roomPxW}
              height={roomPxH}
              pxPerInch={pxPerInch}
            />
          )}
        </Layer>

        {/* Walls (from parser) */}
        <Layer listening={false}>
          {room?.walls && (
            <WallOutline
              walls={room.walls}
              pxPerInch={pxPerInch}
              offsetX={roomOffsetX}
              offsetY={roomOffsetY}
              roomWidth={room.width}
              roomDepth={room.depth}
            />
          )}
        </Layer>

        {zones?.length > 0 && (
          <Layer>
            {zones.map((zone, index) => {
              if (!zone?.polygon || zone.polygon.length < 3) return null;
              const isActive = zone.id === activeZoneId;
              const points = zone.polygon.flatMap(([px, py]) => [
                roomOffsetX + px * pxPerInch,
                roomOffsetY + py * pxPerInch,
              ]);
              const center = zone.polygon.reduce(
                (acc, [px, py]) => ({ x: acc.x + px, y: acc.y + py }),
                { x: 0, y: 0 }
              );
              const cx = roomOffsetX + (center.x / zone.polygon.length) * pxPerInch;
              const cy = roomOffsetY + (center.y / zone.polygon.length) * pxPerInch;
              const color = zone.color || ['#c58d45', '#4f8f6b', '#4273b7', '#9858a6'][index % 4];
              return (
                <Group
                  key={zone.id || index}
                  onClick={() => setActiveZone(isActive ? null : zone.id)}
                  onTap={() => setActiveZone(isActive ? null : zone.id)}
                >
                  <Line
                    points={points}
                    closed
                    fill={color}
                    opacity={isActive ? 0.18 : activeZoneId ? 0.05 : 0.1}
                    stroke={color}
                    strokeWidth={isActive ? 2.5 : 1.25}
                    dash={isActive ? undefined : [6, 4]}
                  />
                  <Text
                    x={cx - 70}
                    y={cy - 8}
                    width={140}
                    align="center"
                    text={zone.name || `Room ${index + 1}`}
                    fontSize={11 / viewport.scale}
                    fill={color}
                    listening={false}
                  />
                </Group>
              );
            })}
          </Layer>
        )}

        {/* Detections overlay */}
        <Layer listening={false}>
          {(detections || []).filter((d) => d.status === 'pending').map((det, i) => {
            const b = det.bbox || [];
            if (b.length !== 4) return null;
            const [x1, y1, x2, y2] = b;
            const px1 = roomOffsetX + x1 * roomPxW;
            const py1 = roomOffsetY + y1 * roomPxH;
            const px2 = roomOffsetX + x2 * roomPxW;
            const py2 = roomOffsetY + y2 * roomPxH;
            return (
              <Group key={i}>
                <Rect
                  x={px1} y={py1}
                  width={px2 - px1} height={py2 - py1}
                  stroke="#9c6a3f" strokeWidth={1.5 / viewport.scale}
                  dash={[6, 4]}
                  fill="rgba(156,106,63,0.08)"
                />
                <Text
                  x={px1 + 4} y={py1 + 4}
                  text={det.label || 'object'}
                  fontSize={11 / viewport.scale}
                  fill="#7e5230"
                />
              </Group>
            );
          })}
        </Layer>

        {/* Furniture */}
        <Layer>
          {furniture.map((it) => (
            <FurnitureItem
              key={it.id}
              item={it}
              pxPerInch={pxPerInch}
              offsetX={roomOffsetX}
              offsetY={roomOffsetY}
              selected={selectedId === it.id}
              room={room}
              allItems={furniture}
              onSelect={() => selectFurniture(it.id)}
              onInvalidPlacement={showPlacementWarning}
              onChange={(patch) => updateFurniture(it.id, patch)}
            />
          ))}
        </Layer>
      </Stage>

      {!room?.width && (
        <div className="absolute inset-0 grid place-items-center text-ink-500 eyebrow pointer-events-none">
          Room dimensions not set — use the toolbar to begin
        </div>
      )}

      {/* Selected item info bar */}
      {selectedId && (() => {
        const sel = furniture.find(f => f.id === selectedId);
        if (!sel) return null;
        return (
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 bg-white/90 backdrop-blur-sm border border-ink-900/15 rounded-lg px-4 py-2 shadow-sm">
            <span className="text-xs font-medium text-ink-800 truncate max-w-[140px]">{sel.name || sel.category}</span>
            <span className="text-[10px] text-ink-500">{sel.width}" × {sel.depth}" · {(sel.rotation || 0).toFixed(1)}°</span>
            <div className="h-3 w-px bg-ink-900/15" />
            <button
              onClick={() => {
                const patch = computeRotation(sel, (sel.rotation || 0) - 15);
                updateFurniture(sel.id, patch);
              }}
              className="text-[10px] uppercase tracking-editorial px-2 py-0.5 rounded border border-ink-900/20 text-ink-700 hover:bg-ink-900 hover:text-paper-50 transition"
            >
              -15°
            </button>
            <button
              onClick={() => {
                const patch = computeRotation(sel, (sel.rotation || 0) + 15);
                updateFurniture(sel.id, patch);
              }}
              className="text-[10px] uppercase tracking-editorial px-2 py-0.5 rounded border border-ink-900/20 text-ink-700 hover:bg-ink-900 hover:text-paper-50 transition"
            >
              +15°
            </button>
            <input
              type="number"
              min="0"
              max="359"
              step="1"
              value={Math.round(sel.rotation || 0)}
              onChange={(e) => {
                const nextValue = Number(e.target.value);
                if (Number.isNaN(nextValue)) return;
                updateFurniture(sel.id, computeRotation(sel, nextValue));
              }}
              className="w-16 rounded border border-ink-900/15 px-2 py-1 text-[11px] text-ink-800"
            />
            <input
              type="range"
              min="0"
              max="359"
              step="1"
              value={Math.round(sel.rotation || 0)}
              onChange={(e) => updateFurniture(sel.id, computeRotation(sel, Number(e.target.value)))}
              className="w-28 accent-ink-900"
            />
            <button
              onClick={() => removeFurniture(selectedId)}
              className="text-[10px] uppercase tracking-editorial px-2 py-0.5 rounded border border-red-300 text-red-600 hover:bg-red-600 hover:text-white transition"
            >
              Delete
            </button>
            <div className="h-3 w-px bg-ink-900/15" />
            <span className="text-[9px] text-ink-400">R +15° · drag rotate handle freely · Del remove</span>
          </div>
        );
      })()}
    </div>
  );
}
