import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Group, Text, Line, Circle } from 'react-konva';
import { useLayoutStore } from '@/store/layoutStore';
import { computeRotation, snapToGrid, inchesToFeet } from '@/utils/scale';
import { getAABB, overlaps, withinRoom } from '@/utils/collision';
import { createPlacedFurnitureFromCatalogItem } from '@/utils/furniturePlacement';
import FurnitureItem from './FurnitureItem';
import GridOverlay from './GridOverlay';
import WallOutline from './WallOutline';
import WallJointHandles from './WallJointHandles';
import RoomBoundsHandles from './RoomBoundsHandles';
import WallDimensionLabels from './WallDimensionLabels';
import {
  isPolygonWallsFormat,
  isSegmentWallsFormat,
  roomRectangleOutline,
  scaleSegmentWallsToRoomBox,
} from '@/utils/roomWallMath';

function getZoneBox(zone) {
  if (Array.isArray(zone?.bbox) && zone.bbox.length === 4) {
    return zone.bbox;
  }

  if (Array.isArray(zone?.polygon) && zone.polygon.length > 0) {
    const xs = zone.polygon.map(([x]) => x);
    const ys = zone.polygon.map(([, y]) => y);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }

  return [0, 0, 0, 0];
}

function clampZoneBox(bbox, room) {
  const width = Math.max(24, bbox[2] - bbox[0]);
  const depth = Math.max(24, bbox[3] - bbox[1]);
  const maxLeft = Math.max(0, (room?.width || width) - width);
  const maxTop = Math.max(0, (room?.depth || depth) - depth);
  const left = Math.min(Math.max(0, bbox[0]), maxLeft);
  const top = Math.min(Math.max(0, bbox[1]), maxTop);

  return [left, top, left + width, top + depth];
}

export default function RoomCanvas() {
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [placementWarning, setPlacementWarning] = useState('');
  const [wallDragPreview, setWallDragPreview] = useState(null);
  const [roomSizePreview, setRoomSizePreview] = useState(null);

  const {
    room, furniture, selectedId, detections, zones, activeZoneId, gridEnabled,
    roomWallsTool, roomResizeTool,
    selectFurniture, clearSelection, updateFurniture, removeFurniture, setActiveZone, updateZone, getVisibleFurniture,
    updateRoom,
    selectedCatalogItem,
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
  const activeZone = activeZoneId ? zones.find((zone) => zone.id === activeZoneId) : null;
  const effectiveRoomW = roomSizePreview?.width ?? room?.width ?? 0;
  const effectiveRoomD = roomSizePreview?.depth ?? room?.depth ?? 0;
  const focusBox = activeZone
    ? getZoneBox(activeZone)
    : [0, 0, Math.max(1, effectiveRoomW), Math.max(1, effectiveRoomD)];
  const focusWidth = Math.max(1, focusBox[2] - focusBox[0]);
  const focusDepth = Math.max(1, focusBox[3] - focusBox[1]);
  const visibleFurniture = getVisibleFurniture();
  const roomForLayout = room
    ? { ...room, width: effectiveRoomW || room.width, depth: effectiveRoomD || room.depth }
    : null;

  const margin = 48;
  const pxPerInchFit = focusWidth && focusDepth
    ? Math.min((size.w - margin * 2) / focusWidth, (size.h - margin * 2) / focusDepth)
    : 4;
  const pxPerInch = pxPerInchFit > 0 ? pxPerInchFit : 4;

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

  const onKeyDown = useCallback((e) => {
    const state = useLayoutStore.getState();
    const { selectedId, furniture, removeFurniture, updateFurniture, clearSelection, undo, redo } = state;

    // Undo / Redo — works everywhere
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    if (mod && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
      return;
    }

    // Escape exits room resize / wall-point modes, then deselects furniture
    if (e.key === 'Escape') {
      const {
        selectedCatalogItem,
        clearSelectedCatalogItem,
        roomWallsTool,
        roomResizeTool,
        clearRoomWallsTool,
        clearRoomResizeTool,
        clearSelection,
      } = useLayoutStore.getState();
      if (selectedCatalogItem) {
        clearSelectedCatalogItem();
        return;
      }
      if (roomWallsTool) clearRoomWallsTool();
      if (roomResizeTool) clearRoomResizeTool();
      clearSelection();
      return;
    }

    // Below shortcuts require a selection
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
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  useEffect(() => {
    setViewport({ x: 0, y: 0, scale: 1 });
  }, [room?.id, activeZoneId]);

  useEffect(() => {
    setWallDragPreview(null);
    setRoomSizePreview(null);
  }, [room?.id]);

  useEffect(() => {
    if (!roomWallsTool) setWallDragPreview(null);
  }, [roomWallsTool]);

  useEffect(() => {
    if (!roomResizeTool) setRoomSizePreview(null);
  }, [roomResizeTool]);

  /** Rooms created from templates often have width/depth but no walls JSON — use a rectangular perimeter in inch segments. */
  const rectangleWallSegments =
    effectiveRoomW > 0 &&
    effectiveRoomD > 0 &&
    !isPolygonWallsFormat(room?.walls)
      ? roomRectangleOutline(effectiveRoomW, effectiveRoomD)
      : null;

  const wallsForOutline = (() => {
    if (isPolygonWallsFormat(room?.walls)) return room.walls;
    if (isSegmentWallsFormat(room?.walls)) {
      const baseSegments = wallDragPreview ?? room.walls;
      if (
        roomResizeTool &&
        roomSizePreview &&
        !wallDragPreview &&
        (room?.width || 0) > 0 &&
        (room?.depth || 0) > 0
      ) {
        return scaleSegmentWallsToRoomBox(
          baseSegments,
          room.width,
          room.depth,
          effectiveRoomW,
          effectiveRoomD,
        );
      }
      return baseSegments;
    }
    return wallDragPreview ?? rectangleWallSegments;
  })();

  const wallsEditableAsSegments =
    Boolean(wallsForOutline) &&
    isSegmentWallsFormat(wallsForOutline) &&
    effectiveRoomW > 0 &&
    effectiveRoomD > 0;

  const wallDimensionSegments =
    wallsForOutline && isSegmentWallsFormat(wallsForOutline) ? wallsForOutline : null;

  const roomPxW = (room?.width || 0) * pxPerInch;
  const roomPxH = (room?.depth || 0) * pxPerInch;
  const focusPxW = focusWidth * pxPerInch;
  const focusPxH = focusDepth * pxPerInch;
  const roomOffsetX = Math.max(margin, (size.w - focusPxW) / 2);
  const roomOffsetY = Math.max(margin, (size.h - focusPxH) / 2);
  const pendingDetections = Array.isArray(detections)
    ? detections.filter((d) => d.status === 'pending')
    : [];
  const placementBounds = activeZone
    ? { left: focusBox[0], top: focusBox[1], right: focusBox[2], bottom: focusBox[3] }
    : null;

  const toCanvasX = (value) => roomOffsetX + (value - focusBox[0]) * pxPerInch;
  const toCanvasY = (value) => roomOffsetY + (value - focusBox[1]) * pxPerInch;

  const warningTimeoutRef = useRef(null);
  const showPlacementWarning = useCallback((message) => {
    setPlacementWarning(message);
    if (warningTimeoutRef.current) window.clearTimeout(warningTimeoutRef.current);
    warningTimeoutRef.current = window.setTimeout(() => setPlacementWarning(''), 2200);
  }, []);

  const handleCatalogPlacementClick = useCallback(
    async (e) => {
      const cat = useLayoutStore.getState().selectedCatalogItem;
      const currentRoom = useLayoutStore.getState().room;
      if (!cat || !currentRoom || e.evt.button !== 0) return;

      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getRelativePointerPosition();
      if (pointer == null) return;

      const inchX = focusBox[0] + (pointer.x - roomOffsetX) / pxPerInch;
      const inchY = focusBox[1] + (pointer.y - roomOffsetY) / pxPerInch;

      const draftPlacement = createPlacedFurnitureFromCatalogItem(cat, {
        x_inches: inchX,
        y_inches: inchY,
      });

      const box = getAABB(draftPlacement);
      const layoutRoom = roomForLayout || currentRoom;
      if (!withinRoom(box, layoutRoom)) {
        showPlacementWarning(`${draftPlacement.name || 'Item'} would extend outside the room.`);
        return;
      }

      if (placementBounds) {
        const insideZone =
          box.left >= placementBounds.left
          && box.top >= placementBounds.top
          && box.right <= placementBounds.right
          && box.bottom <= placementBounds.bottom;
        if (!insideZone) {
          showPlacementWarning('Place inside the selected room area.');
          return;
        }
      }

      const clash = visibleFurniture.some((f) => overlaps(box, getAABB(f)));
      if (clash) {
        showPlacementWarning('That spot overlaps another furniture item.');
        return;
      }

      e.cancelBubble = true;
      const placed = await useLayoutStore.getState().addFurniture(draftPlacement);
      if (placed?.id) useLayoutStore.getState().selectFurniture(placed.id);
    },
    [
      focusBox,
      roomOffsetX,
      roomOffsetY,
      pxPerInch,
      placementBounds,
      visibleFurniture,
      roomForLayout,
      showPlacementWarning,
    ],
  );

  return (
    <div ref={wrapRef} className="relative w-full h-full bg-surface-800" style={{ touchAction: 'none', userSelect: 'none' }}>
      {/* Corner metadata */}
      <div className="absolute top-4 left-4 text-xs text-surface-400 z-10 pointer-events-none font-mono">
        {room?.width
          ? `${inchesToFeet(effectiveRoomW || room.width)} × ${inchesToFeet(effectiveRoomD || room.depth)}`
          : 'Untitled canvas'}
      </div>
      <div className="absolute bottom-4 right-4 text-xs text-surface-400 z-10 pointer-events-none font-mono">
        Zoom {(viewport.scale * 100).toFixed(0)}%
      </div>
      {placementWarning && (
        <div className="absolute top-4 right-4 z-10 rounded-md border border-red-500 bg-surface-900/95 px-3 py-2 text-xs text-red-400 shadow-lg backdrop-blur-sm">
          {placementWarning}
        </div>
      )}
      {selectedCatalogItem && (
        <div className="absolute top-14 left-4 z-10 max-w-[min(90vw,20rem)] rounded-md border border-[#004aad]/35 bg-[#eef4f7]/95 px-3 py-2 text-[11px] text-[#004aad] shadow-sm backdrop-blur-sm pointer-events-none">
          Selected: <span className="font-medium text-[#171717]">{selectedCatalogItem.name}</span>. Click the canvas to place.
          <span className="block text-[10px] text-[#5b5b5b] mt-1">Esc clears catalog selection.</span>
        </div>
      )}
      {roomResizeTool && room?.width > 0 && (
        <div className="absolute left-1/2 top-14 z-10 -translate-x-1/2 pointer-events-none rounded-md border border-amber-500/50 bg-surface-900/90 px-3 py-1.5 text-[11px] text-amber-100/95 shadow-md max-w-[min(90vw,28rem)] text-center">
          Resize floor: drag orange handles on the right, bottom, or corner to change width × depth (top-left stays fixed). Save to keep changes.
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
        {/* Room floor */}
        <Layer listening={false}>
          {focusWidth > 0 && (
            <Rect
              x={roomOffsetX} y={roomOffsetY}
              width={focusPxW} height={focusPxH}
              fill="#2a2a2a"
              stroke="#404040"
              strokeWidth={2 / viewport.scale}
            />
          )}
        </Layer>

        {/* Grid */}
        <Layer listening={false}>
          {gridEnabled && effectiveRoomW > 0 && room?.width && (
            <GridOverlay
              originX={roomOffsetX}
              originY={roomOffsetY}
              width={focusPxW}
              height={focusPxH}
              pxPerInch={pxPerInch}
            />
          )}
        </Layer>

        {/* Walls (from parser or live drag preview) */}
        <Layer listening={false}>
          {wallsForOutline && (
            <WallOutline
              walls={wallsForOutline}
              pxPerInch={pxPerInch}
              offsetX={roomOffsetX}
              offsetY={roomOffsetY}
              roomWidth={effectiveRoomW || room.width}
              roomDepth={effectiveRoomD || room.depth}
              viewOriginX={focusBox[0]}
              viewOriginY={focusBox[1]}
            />
          )}
        </Layer>

        {zones?.length > 0 && (
          <Layer>
            {zones.map((zone, index) => {
              const bbox = getZoneBox(zone);
              const zoneWidth = Math.max(24, bbox[2] - bbox[0]);
              const zoneDepth = Math.max(24, bbox[3] - bbox[1]);
              const isActive = zone.id === activeZoneId;
              const zx = toCanvasX(bbox[0]);
              const zy = toCanvasY(bbox[1]);
              const zw = zoneWidth * pxPerInch;
              const zh = zoneDepth * pxPerInch;
              const color = zone.color || ['#c58d45', '#4f8f6b', '#4273b7', '#9858a6'][index % 4];

              const commitBox = (nextBox) => {
                updateZone(zone.id, {
                  bbox: clampZoneBox(nextBox, roomForLayout || room),
                });
              };

              return (
                <Group
                  key={zone.id || index}
                  onClick={() => setActiveZone(isActive ? null : zone.id)}
                  onTap={() => setActiveZone(isActive ? null : zone.id)}
                >
                  {zone.polygon && zone.polygon.length >= 3 ? (
                    <Line
                      points={zone.polygon.flatMap(([px, py]) => [
                        toCanvasX(px / (room?.scale_px_per_inch || 1)),
                        toCanvasY(py / (room?.scale_px_per_inch || 1)),
                      ])}
                      closed
                      fill={color}
                      opacity={isActive ? 0.18 : activeZoneId ? 0.05 : 0.1}
                      stroke={color}
                      strokeWidth={isActive ? 2.5 : 1.25}
                      dash={isActive ? undefined : [6, 4]}
                    />
                  ) : (
                    <Line
                      points={[zx, zy, zx + zw, zy, zx + zw, zy + zh, zx, zy + zh]}
                      closed
                      fill={color}
                      opacity={isActive ? 0.18 : activeZoneId ? 0.05 : 0.1}
                      stroke={color}
                      strokeWidth={isActive ? 2.5 : 1.25}
                      dash={isActive ? undefined : [6, 4]}
                    />
                  )}
                  <Rect
                    x={zx}
                    y={zy}
                    width={zw}
                    height={zh}
                    fill="transparent"
                    strokeEnabled={false}
                    draggable
                    onDragEnd={(e) => {
                      const left = focusBox[0] + ((e.target.x() - roomOffsetX) / pxPerInch);
                      const top = focusBox[1] + ((e.target.y() - roomOffsetY) / pxPerInch);
                      commitBox([left, top, left + zoneWidth, top + zoneDepth]);
                    }}
                  />
                  <Text
                    x={zx + 10}
                    y={zy + 10}
                    width={Math.max(80, zw - 20)}
                    align="left"
                    text={`${zone.name || `Room ${index + 1}`}\n${Math.round(zoneWidth)}" × ${Math.round(zoneDepth)}"`}
                    fontSize={11 / viewport.scale}
                    fill={color}
                    listening={false}
                  />
                  <Circle
                    x={zx + zw}
                    y={zy + zh}
                    radius={6 / viewport.scale}
                    fill={isActive ? color : '#ffffff'}
                    stroke={color}
                    strokeWidth={1.5 / viewport.scale}
                    draggable
                    onDragEnd={(e) => {
                      const right = focusBox[0] + ((e.target.x() - roomOffsetX) / pxPerInch);
                      const bottom = focusBox[1] + ((e.target.y() - roomOffsetY) / pxPerInch);
                      commitBox([bbox[0], bbox[1], Math.max(bbox[0] + 24, right), Math.max(bbox[1] + 24, bottom)]);
                    }}
                  />
                </Group>
              );
            })}
          </Layer>
        )}

        {/* Per-wall length labels — above zone fills so edges stay readable */}
        {wallDimensionSegments && (
          <Layer listening={false}>
            <WallDimensionLabels
              segments={wallDimensionSegments}
              roomOffsetX={roomOffsetX}
              roomOffsetY={roomOffsetY}
              pxPerInch={pxPerInch}
              viewOriginX={focusBox[0]}
              viewOriginY={focusBox[1]}
              viewportScale={viewport.scale}
            />
          </Layer>
        )}

        {/* Detections overlay */}
        <Layer listening={false}>
          {pendingDetections.map((det, i) => {
            const b = det.bbox || [];
            if (b.length !== 4) return null;
            const [x1, y1, x2, y2] = b;
            const px1 = toCanvasX(x1 * (effectiveRoomW || room?.width || 0));
            const py1 = toCanvasY(y1 * (effectiveRoomD || room?.depth || 0));
            const px2 = toCanvasX(x2 * (effectiveRoomW || room?.width || 0));
            const py2 = toCanvasY(y2 * (effectiveRoomD || room?.depth || 0));
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

        {/* Click-to-place starter catalog (under furniture so placed items stay draggable) */}
        {selectedCatalogItem && focusWidth > 0 && focusDepth > 0 && (
          <Layer>
            <Rect
              x={roomOffsetX}
              y={roomOffsetY}
              width={focusPxW}
              height={focusPxH}
              fill="transparent"
              onMouseDown={handleCatalogPlacementClick}
            />
          </Layer>
        )}

        {/* Furniture */}
        <Layer>
          {visibleFurniture.map((it) => (
            <FurnitureItem
              key={it.id}
              item={it}
              pxPerInch={pxPerInch}
              offsetX={roomOffsetX}
              offsetY={roomOffsetY}
              selected={selectedId === it.id}
              room={roomForLayout || room}
              allItems={visibleFurniture}
              placementBounds={placementBounds}
              viewOriginX={focusBox[0]}
              viewOriginY={focusBox[1]}
              onSelect={() => selectFurniture(it.id)}
              onInvalidPlacement={showPlacementWarning}
              onChange={(patch) => updateFurniture(it.id, patch)}
            />
          ))}
        </Layer>

        {/* Resize room bounds — above furniture */}
        {roomResizeTool && effectiveRoomW > 0 && effectiveRoomD > 0 && (
          <Layer>
            <RoomBoundsHandles
              roomWidth={effectiveRoomW}
              roomDepth={effectiveRoomD}
              roomOffsetX={roomOffsetX}
              roomOffsetY={roomOffsetY}
              pxPerInch={pxPerInch}
              viewOriginX={focusBox[0]}
              viewOriginY={focusBox[1]}
              viewportScale={viewport.scale}
              enabled={roomResizeTool}
              onPreviewChange={setRoomSizePreview}
              onCommit={(dims) => {
                updateRoom({ width: dims.width, depth: dims.depth });
                setRoomSizePreview(null);
              }}
            />
          </Layer>
        )}

        {/* Draggable wall joints — above furniture for pointer priority */}
        {roomWallsTool && wallsEditableAsSegments && (
          <Layer>
            <WallJointHandles
              walls={wallsForOutline}
              roomWidth={effectiveRoomW || room.width}
              roomDepth={effectiveRoomD || room.depth}
              roomOffsetX={roomOffsetX}
              roomOffsetY={roomOffsetY}
              pxPerInch={pxPerInch}
              viewOriginX={focusBox[0]}
              viewOriginY={focusBox[1]}
              viewportScale={viewport.scale}
              enabled={roomWallsTool}
              onPreviewChange={setWallDragPreview}
              onCommit={(nextWalls) => {
                updateRoom({ walls: nextWalls });
                setWallDragPreview(null);
              }}
            />
          </Layer>
        )}
      </Stage>

      {!room?.width && (
        <div className="absolute inset-0 grid place-items-center text-ink-500 eyebrow pointer-events-none">
          Room dimensions not set — use the toolbar to begin
        </div>
      )}

      {/* Selected item info bar */}
      {selectedId && (() => {
        const sel = visibleFurniture.find(f => f.id === selectedId);
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
