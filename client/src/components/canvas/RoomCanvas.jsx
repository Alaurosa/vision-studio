import { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Rect, Text, Group } from 'react-konva';
import useImage from 'use-image';
import { useLayoutStore } from '../../store/layoutStore';
import FurnitureItem from './FurnitureItem';
import WallOutline from './WallOutline';
import GridOverlay from './GridOverlay';
import { CATEGORY_COLORS, MIN_CLEARANCE_IN } from '../../utils/constants';

export default function RoomCanvas({ showClearance = false }) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState(null); // { x, y, item }

  const {
    room,
    furniture,
    selectedId,
    detections,
    gridEnabled,
    zones,
    activeZoneId,
    selectFurniture,
    updateFurniture,
    removeFurniture,
    clearSelection,
    confirmDetection,
    dismissDetection,
    setActiveZone,
  } = useLayoutStore();

  // Filter furniture by active zone (null = show all)
  const visibleFurniture = activeZoneId
    ? furniture.filter((f) => f.zone_id === activeZoneId)
    : furniture;

  const imageUrl = room?.floor_plan_url || room?.room_photo_url || undefined;
  const [floorPlanImg] = useImage(imageUrl);
  const scale = room?.scale_px_per_inch || 4.0;

  // Detected objects from floor plan parsing
  const detectedObjects = room?.detected_objects;
  const imageW = detectedObjects?.image_width;
  const imageH = detectedObjects?.image_height;
  const boundary = detectedObjects?.boundary;

  // When a floor plan has been parsed, room.width/depth are in image pixels (scale=1).
  // Polygons from the parser are also in image pixels, so wallScale = scale (= 1.0).
  const hasFloorPlan = !!(floorPlanImg && imageW && imageH);

  // Calculate room dimensions in canvas pixels
  const roomWidthPx = room?.width ? room.width * scale : 0;
  const roomDepthPx = room?.depth ? room.depth * scale : 0;

  // For floor-plan mode: we render the entire image scaled to fit the canvas
  // and all coords are in image pixels → canvas pixels via a uniform scale.
  let displayW, displayH, imgScale, offsetX, offsetY, imgOffsetX, imgOffsetY;

  if (hasFloorPlan) {
    // Fit the floor plan image into the canvas with some padding
    const padding = 40;
    const fitScaleX = (size.width - padding * 2) / imageW;
    const fitScaleY = (size.height - padding * 2) / imageH;
    imgScale = Math.min(fitScaleX, fitScaleY, 2); // don't upscale beyond 2×
    displayW = imageW * imgScale;
    displayH = imageH * imgScale;
    // Center the image in the canvas
    imgOffsetX = Math.max(padding, (size.width - displayW) / 2);
    imgOffsetY = Math.max(padding, (size.height - displayH) / 2);
    // For wall/room polygon rendering: polygons are in image pixels, multiply by imgScale
    offsetX = imgOffsetX;
    offsetY = imgOffsetY;
  } else {
    imgScale = scale;
    displayW = roomWidthPx || size.width;
    displayH = roomDepthPx || size.height;
    offsetX = roomWidthPx > 0 ? Math.max(20, (size.width - roomWidthPx) / 2) : 0;
    offsetY = roomDepthPx > 0 ? Math.max(20, (size.height - roomDepthPx) / 2) : 0;
    imgOffsetX = offsetX;
    imgOffsetY = offsetY;
  }

  // wallScale: maps image pixel coordinates to canvas pixel coordinates
  const wallScale = hasFloorPlan ? imgScale : scale;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const scaleBy = 1.08;
    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.min(4, Math.max(0.2, direction > 0 ? oldScale * scaleBy : oldScale / scaleBy));
    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const zoomTo = (newScale) => {
    const centerX = size.width / 2;
    const centerY = size.height / 2;
    const mousePointTo = {
      x: (centerX - stagePos.x) / stageScale,
      y: (centerY - stagePos.y) / stageScale,
    };
    setStageScale(newScale);
    setStagePos({
      x: centerX - mousePointTo.x * newScale,
      y: centerY - mousePointTo.y * newScale,
    });
  };

  const resetView = () => {
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
  };

  const fitToView = () => {
    const contentW = hasFloorPlan ? displayW + imgOffsetX * 2 : (roomWidthPx ? roomWidthPx + offsetX * 2 : 0);
    const contentH = hasFloorPlan ? displayH + imgOffsetY * 2 : (roomDepthPx ? roomDepthPx + offsetY * 2 : 0);
    if (!contentW || !contentH) return resetView();
    const padding = 60;
    const fitScale = Math.min(
      (size.width - padding) / contentW,
      (size.height - padding) / contentH,
      2
    );
    setStageScale(fitScale);
    setStagePos({
      x: (size.width - contentW * fitScale) / 2,
      y: (size.height - contentH * fitScale) / 2,
    });
  };

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        draggable
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onClick={(e) => {
          if (e.target === e.target.getStage()) { clearSelection(); setContextMenu(null); }
        }}
        onContextMenu={(e) => {
          if (e.target === e.target.getStage()) { e.evt.preventDefault(); setContextMenu(null); }
        }}
        onWheel={handleWheel}
        style={{ background: '#eae8e3', cursor: 'grab' }}
      >
        {/* Layer 0: Background image */}
        <Layer listening={false}>
          {floorPlanImg && (
            <KonvaImage
              image={floorPlanImg}
              x={imgOffsetX}
              y={imgOffsetY}
              width={displayW}
              height={displayH}
              opacity={hasFloorPlan ? 0.9 : 0.35}
            />
          )}
        </Layer>

        {/* Layer 1: Room boundary + Grid */}
        <Layer listening={false}>
          {/* Room floor fill (only in non-floorplan mode) */}
          {!hasFloorPlan && roomWidthPx > 0 && roomDepthPx > 0 && (
            <Rect
              x={offsetX}
              y={offsetY}
              width={roomWidthPx}
              height={roomDepthPx}
              fill="#f5f4f0"
              stroke="#555"
              strokeWidth={2}
            />
          )}
          {gridEnabled && !hasFloorPlan && roomWidthPx > 0 && roomDepthPx > 0 && (
            <GridOverlay
              width={roomWidthPx}
              height={roomDepthPx}
              scale={scale}
              offsetX={offsetX}
              offsetY={offsetY}
            />
          )}
          {gridEnabled && !hasFloorPlan && !roomWidthPx && (
            <GridOverlay width={size.width} height={size.height} scale={scale} offsetX={0} offsetY={0} />
          )}
        </Layer>

        {/* Layer 2: Room walls + detected rooms */}
        <Layer listening={false}>
          {room?.walls && (
            <WallOutline
              walls={room.walls}
              scale={wallScale}
              offsetX={offsetX}
              offsetY={offsetY}
              rooms={detectedObjects?.rooms}
            />
          )}
        </Layer>

        {/* Layer 2.5: Confirmed zones (clickable sub-rooms) */}
        {zones && zones.length > 0 && (
          <Layer>
            {zones.map((zone, i) => {
              if (!zone.polygon || zone.polygon.length < 3) return null;
              const isActive = zone.id === activeZoneId;
              const dimmed = activeZoneId && !isActive;
              const color = zone.color || '#3b82f6';
              const points = zone.polygon.flatMap(([px, py]) => [
                px * wallScale + offsetX,
                py * wallScale + offsetY,
              ]);
              // Centroid for label placement
              let cx = 0, cy = 0;
              for (const [px, py] of zone.polygon) {
                cx += px * wallScale + offsetX;
                cy += py * wallScale + offsetY;
              }
              cx /= zone.polygon.length;
              cy /= zone.polygon.length;
              return (
                <Group
                  key={zone.id}
                  onClick={() => setActiveZone(isActive ? null : zone.id)}
                  onTap={() => setActiveZone(isActive ? null : zone.id)}
                  onMouseEnter={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'pointer';
                  }}
                  onMouseLeave={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'default';
                  }}
                >
                  <Line
                    points={points}
                    closed
                    stroke={color}
                    strokeWidth={isActive ? 3 : 2}
                    fill={color}
                    opacity={dimmed ? 0.08 : isActive ? 0.22 : 0.14}
                    dash={isActive ? undefined : [6, 4]}
                  />
                  <Text
                    x={cx - 60}
                    y={cy - 8}
                    width={120}
                    text={zone.name || `Room ${i + 1}`}
                    fontSize={isActive ? 13 : 11}
                    fontStyle={isActive ? 'bold' : 'normal'}
                    fill={isActive ? color : '#555'}
                    align="center"
                    listening={false}
                    opacity={dimmed ? 0.4 : 1}
                  />
                </Group>
              );
            })}
          </Layer>
        )}

        {/* Layer 3: Room dimension labels (hide in floor plan mode — dims are pixels, not real) */}
        <Layer listening={false}>
          {!hasFloorPlan && roomWidthPx > 0 && roomDepthPx > 0 && (
            <>
              {/* Width label (top) */}
              <Text
                x={offsetX}
                y={offsetY - 18}
                width={roomWidthPx}
                text={`${room.width}" (${(room.width / 12).toFixed(1)} ft)`}
                fontSize={11}
                fill="#888"
                align="center"
              />
              {/* Depth label (left) */}
              <Text
                x={offsetX - 16}
                y={offsetY + roomDepthPx / 2}
                text={`${room.depth}"`}
                fontSize={11}
                fill="#888"
                rotation={-90}
              />
            </>
          )}
        </Layer>

        {/* Layer 4: AI detection overlay */}
        <Layer>
          {(detections || [])
            .filter((d) => d.status === 'pending')
            .map((det, i) => {
              const bbox = det.bbox || [0, 0, 0, 0];
              // Detect whether bbox is normalized (0-1) or absolute image pixels
              const isNormalized = bbox.every((v) => v >= 0 && v <= 1.01);
              let x1, y1, x2, y2;
              if (isNormalized) {
                x1 = bbox[0] * (hasFloorPlan ? displayW : (roomWidthPx || size.width)) + offsetX;
                y1 = bbox[1] * (hasFloorPlan ? displayH : (roomDepthPx || size.height)) + offsetY;
                x2 = bbox[2] * (hasFloorPlan ? displayW : (roomWidthPx || size.width)) + offsetX;
                y2 = bbox[3] * (hasFloorPlan ? displayH : (roomDepthPx || size.height)) + offsetY;
              } else {
                // Absolute pixel coords from parser — scale by wallScale
                x1 = bbox[0] * wallScale + offsetX;
                y1 = bbox[1] * wallScale + offsetY;
                x2 = bbox[2] * wallScale + offsetX;
                y2 = bbox[3] * wallScale + offsetY;
              }
              return (
                <Group key={`det-${i}`}>
                  <Rect
                    x={x1}
                    y={y1}
                    width={x2 - x1}
                    height={y2 - y1}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dash={[6, 3]}
                    fill="rgba(59,130,246,0.08)"
                  />
                  <Text
                    x={x1 + 4}
                    y={y1 + 4}
                    text={`${det.label} (${Math.round((det.score || 0) * 100)}%)`}
                    fontSize={12}
                    fill="#1e40af"
                  />
                </Group>
              );
            })}
        </Layer>

        {/* Layer 4.5: Clearance zones */}
        {showClearance && visibleFurniture.length > 0 && (
          <Layer listening={false}>
            {visibleFurniture.map((item) => {
              const clearPx = MIN_CLEARANCE_IN * scale;
              const w = (item.width || 30) * scale;
              const d = (item.depth || 30) * scale;
              const ix = (item.x_inches || 0) * scale + offsetX;
              const iy = (item.y_inches || 0) * scale + offsetY;
              return (
                <Rect
                  key={`cl-${item.id}`}
                  x={ix - clearPx}
                  y={iy - clearPx}
                  width={w + clearPx * 2}
                  height={d + clearPx * 2}
                  fill="rgba(251, 191, 36, 0.08)"
                  stroke="#f59e0b"
                  strokeWidth={1}
                  dash={[4, 4]}
                  cornerRadius={4}
                />
              );
            })}
          </Layer>
        )}

        {/* Layer 5: Placed furniture (filtered by active zone) */}
        <Layer>
          {visibleFurniture.map((item) => (
            <FurnitureItem
              key={item.id}
              item={item}
              scale={scale}
              offsetX={offsetX}
              offsetY={offsetY}
              isSelected={item.id === selectedId}
              onSelect={() => selectFurniture(item.id)}
              onChange={(updated) => updateFurniture(item.id, updated)}
              onContextMenu={(data) => setContextMenu(data)}
              allFurniture={visibleFurniture}
              room={room}
            />
          ))}
        </Layer>
      </Stage>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-md border border-white/10 px-1 py-1 z-10">
        <button onClick={() => zoomTo(Math.min(4, stageScale * 1.25))} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition" title="Zoom in">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        </button>
        <button onClick={resetView} className="px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded transition min-w-[48px] text-center" title="Reset zoom">
          {Math.round(stageScale * 100)}%
        </button>
        <button onClick={() => zoomTo(Math.max(0.2, stageScale / 1.25))} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition" title="Zoom out">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>
        </button>
        <div className="w-px h-5 bg-slate-700 mx-0.5" />
        <button onClick={fitToView} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition" title="Fit to view">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
        </button>
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed bg-slate-900/70 rounded-lg shadow-xl border border-white/10 py-1 z-50 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
            onClick={() => {
              const cur = contextMenu.item.rotation || 0;
              updateFurniture(contextMenu.item.id, { rotation: (cur + 90) % 360 });
              setContextMenu(null);
            }}
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
            Rotate 90°
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
            onClick={() => {
              if (room?.width && room?.depth) {
                const cx = (room.width - (contextMenu.item.width || 30)) / 2;
                const cy = (room.depth - (contextMenu.item.depth || 30)) / 2;
                updateFurniture(contextMenu.item.id, { x_inches: Math.round(cx), y_inches: Math.round(cy) });
              }
              setContextMenu(null);
            }}
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
            Center in Room
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
            onClick={() => {
              updateFurniture(contextMenu.item.id, { x_inches: 0, y_inches: 0 });
              setContextMenu(null);
            }}
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" /></svg>
            Move to Origin
          </button>
          <div className="border-t border-white/10 my-1" />
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
            onClick={() => {
              removeFurniture(contextMenu.item.id);
              setContextMenu(null);
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
            Delete
          </button>
        </div>
      )}

      {/* Canvas empty state */}
      {!room?.width && !room?.depth && !room?.floor_plan_url && !room?.walls && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center pointer-events-auto bg-slate-900/95 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-white/10 max-w-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
              </svg>
            </div>
            <p className="text-slate-200 text-sm font-semibold mb-1">No room configured</p>
            <p className="text-slate-500 text-xs leading-relaxed mb-4">Upload a floor plan to auto-detect walls, or use the toolbar to set room dimensions manually.</p>
            <div className="flex gap-2 justify-center">
              <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-1 rounded-full border border-white/10">Upload from toolbar ↑</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
