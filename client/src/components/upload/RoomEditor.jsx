import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ROOM_ZONE_COLORS } from '@/utils/constants';

/* ─── helpers ─── */

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

const MIN_BOX = 20; // minimum box size in px

/**
 * Convert raw AI zones (in pixel coords) to editor state.
 * Each zone gets auto-color and a generated id if needed.
 */
function initZones(zones) {
  return (zones || []).map((z, i) => ({
    id: z.id || `zone-${i}`,
    name: z.name || z.label || `Room ${i + 1}`,
    bbox: [...(z.bbox || [0, 0, 100, 100])],
    color: z.color || ROOM_ZONE_COLORS[i % ROOM_ZONE_COLORS.length],
    confidence: z.confidence ?? null,
    // User-editable dimensions (in inches) — initialised later from scale
    widthIn: null,
    depthIn: null,
  }));
}

function pxToInches(px, scale) { return scale > 0 ? px / scale : px; }
function inchesToPx(inches, scale) { return scale > 0 ? inches * scale : inches; }

function fmtFeetInches(totalInches) {
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

function parseFeetInches(str) {
  // Accepts: 12'6", 12' 6", 12.5', 150", 12ft 6in, 12 6 etc.
  const s = str.trim().replace(/ft/gi, "'").replace(/in/gi, '"').replace(/,/g, '');
  // Try feet'inches" format
  const m = s.match(/^(\d+(?:\.\d+)?)\s*['′]?\s*(\d+(?:\.\d+)?)?\s*["″]?\s*$/);
  if (m) {
    const feet = parseFloat(m[1]) || 0;
    const inches = parseFloat(m[2]) || 0;
    return feet * 12 + inches;
  }
  // Try pure number (inches)
  const n = parseFloat(s);
  if (!isNaN(n)) return n;
  return null;
}

/* ─── drag / resize helpers ─── */

const HANDLE_SIZE = 8;

function getHandles(bbox, scale) {
  const [x1, y1, x2, y2] = bbox;
  const hs = HANDLE_SIZE / scale;
  return [
    { cursor: 'nw-resize', dx: -1, dy: -1, x: x1 - hs / 2, y: y1 - hs / 2 },
    { cursor: 'n-resize',  dx: 0,  dy: -1, x: (x1 + x2) / 2 - hs / 2, y: y1 - hs / 2 },
    { cursor: 'ne-resize', dx: 1,  dy: -1, x: x2 - hs / 2, y: y1 - hs / 2 },
    { cursor: 'w-resize',  dx: -1, dy: 0,  x: x1 - hs / 2, y: (y1 + y2) / 2 - hs / 2 },
    { cursor: 'e-resize',  dx: 1,  dy: 0,  x: x2 - hs / 2, y: (y1 + y2) / 2 - hs / 2 },
    { cursor: 'sw-resize', dx: -1, dy: 1,  x: x1 - hs / 2, y: y2 - hs / 2 },
    { cursor: 's-resize',  dx: 0,  dy: 1,  x: (x1 + x2) / 2 - hs / 2, y: y2 - hs / 2 },
    { cursor: 'se-resize', dx: 1,  dy: 1,  x: x2 - hs / 2, y: y2 - hs / 2 },
  ];
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ROOM EDITOR
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function RoomEditor({
  imageUrl,
  imageWidth,
  imageHeight,
  initialZones,
  boundary,
  scalePxPerInch,
  onConfirm,
  onCancel,
}) {
  /* ── state ── */
  const [zones, setZones] = useState(() => initZones(initialZones));
  const [selectedId, setSelectedId] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [drawEnd, setDrawEnd] = useState(null);
  const [editPanel, setEditPanel] = useState(null); // zone being edited in detail panel
  const [dragState, setDragState] = useState(null); // { zoneId, type: 'move'|'resize', handleIdx, startMouse, startBbox }

  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // Scale: how many CSS px per image px. Fit the image in the viewport.
  const [viewScale, setViewScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      if (!containerRef.current || !imageWidth || !imageHeight) return;
      const cw = containerRef.current.clientWidth - 360; // leave room for side panel
      const ch = containerRef.current.clientHeight - 40;
      const s = Math.min(cw / imageWidth, ch / imageHeight, 1);
      setViewScale(Math.max(0.15, s));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [imageWidth, imageHeight]);

  const scale = scalePxPerInch || 1; // px per inch in the image



  /* ── mouse → image coordinates ── */
  const mouseToImg = useCallback((e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) / viewScale,
      y: (e.clientY - rect.top) / viewScale,
    };
  }, [viewScale]);

  /* ── drag / resize ── */
  const onPointerDown = useCallback((e, zoneId, type, handleIdx) => {
    e.stopPropagation();
    e.preventDefault();
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;
    setSelectedId(zoneId);
    const pos = mouseToImg(e);
    setDragState({ zoneId, type, handleIdx, startMouse: pos, startBbox: [...zone.bbox] });
  }, [zones, mouseToImg]);

  const onPointerMove = useCallback((e) => {
    // Drawing mode
    if (drawing && drawStart) {
      const pos = mouseToImg(e);
      setDrawEnd(pos);
      return;
    }
    if (!dragState) return;
    const pos = mouseToImg(e);
    const dx = pos.x - dragState.startMouse.x;
    const dy = pos.y - dragState.startMouse.y;
    const [ox1, oy1, ox2, oy2] = dragState.startBbox;

    setZones(prev => prev.map(z => {
      if (z.id !== dragState.zoneId) return z;
      let [x1, y1, x2, y2] = [ox1, oy1, ox2, oy2];

      if (dragState.type === 'move') {
        const w = x2 - x1, h = y2 - y1;
        x1 = clamp(ox1 + dx, 0, imageWidth - w);
        y1 = clamp(oy1 + dy, 0, imageHeight - h);
        x2 = x1 + w;
        y2 = y1 + h;
      } else {
        // Resize via handle
        const handles = getHandles(dragState.startBbox, viewScale);
        const h = handles[dragState.handleIdx];
        if (h.dx < 0) x1 = clamp(ox1 + dx, 0, ox2 - MIN_BOX);
        if (h.dx > 0) x2 = clamp(ox2 + dx, ox1 + MIN_BOX, imageWidth);
        if (h.dy < 0) y1 = clamp(oy1 + dy, 0, oy2 - MIN_BOX);
        if (h.dy > 0) y2 = clamp(oy2 + dy, oy1 + MIN_BOX, imageHeight);
      }
      return { ...z, bbox: [x1, y1, x2, y2] };
    }));
  }, [dragState, drawing, drawStart, mouseToImg, imageWidth, imageHeight, viewScale]);

  const onPointerUp = useCallback(() => {
    // Finish drawing
    if (drawing && drawStart && drawEnd) {
      const x1 = Math.min(drawStart.x, drawEnd.x);
      const y1 = Math.min(drawStart.y, drawEnd.y);
      const x2 = Math.max(drawStart.x, drawEnd.x);
      const y2 = Math.max(drawStart.y, drawEnd.y);
      if (x2 - x1 > MIN_BOX && y2 - y1 > MIN_BOX) {
        const idx = zones.length;
        const newZone = {
          id: `zone-${Date.now()}`,
          name: `Room ${zones.length + 1}`,
          bbox: [x1, y1, x2, y2],
          color: ROOM_ZONE_COLORS[idx % ROOM_ZONE_COLORS.length],
          confidence: null,
          widthIn: null,
          depthIn: null,
        };
        setZones(prev => [...prev, newZone]);
        setSelectedId(newZone.id);
      }
      setDrawStart(null);
      setDrawEnd(null);
      setDrawing(false);
      return;
    }
    setDragState(null);
  }, [drawing, drawStart, drawEnd, zones.length]);

  // Drawing start
  const onSvgPointerDown = useCallback((e) => {
    if (drawing) {
      const pos = mouseToImg(e);
      setDrawStart(pos);
      setDrawEnd(pos);
      return;
    }
    // Deselect if clicking empty space
    setSelectedId(null);
  }, [drawing, mouseToImg]);

  /* ── zone actions ── */
  const removeZone = (id) => {
    setZones(prev => prev.filter(z => z.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editPanel === id) setEditPanel(null);
  };

  const updateZoneName = (id, name) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, name } : z));
  };

  const updateZoneDimension = (id, field, valueStr) => {
    const inches = parseFeetInches(valueStr);
    if (inches == null || inches <= 0) return;
    setZones(prev => prev.map(z => {
      if (z.id !== id) return z;
      const px = inchesToPx(inches, scale);
      const newBbox = [...z.bbox];
      if (field === 'width') {
        newBbox[2] = newBbox[0] + px;
      } else {
        newBbox[3] = newBbox[1] + px;
      }
      return { ...z, bbox: newBbox };
    }));
  };

  /* ── confirm ── */
  const handleConfirm = () => {
    // Convert zones back to the format expected by the store/server
    const finalZones = zones.map((z, i) => {
      const [x1, y1, x2, y2] = z.bbox;
      const wPx = x2 - x1;
      const hPx = y2 - y1;
      return {
        id: z.id,
        name: z.name,
        bbox: z.bbox.map(v => Math.round(v)),
        polygon: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(([x, y]) => [Math.round(x), Math.round(y)]),
        width: Math.round(pxToInches(wPx, scale)),
        depth: Math.round(pxToInches(hPx, scale)),
        color: z.color,
      };
    });
    onConfirm(finalZones);
  };

  /* ── drawing bbox preview ── */
  const drawRect = useMemo(() => {
    if (!drawStart || !drawEnd) return null;
    return {
      x: Math.min(drawStart.x, drawEnd.x),
      y: Math.min(drawStart.y, drawEnd.y),
      w: Math.abs(drawEnd.x - drawStart.x),
      h: Math.abs(drawEnd.y - drawStart.y),
    };
  }, [drawStart, drawEnd]);

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-paper-50 flex flex-col"
    >
      {/* ── Top bar ── */}
      <div className="h-14 border-b border-ink-900/10 bg-paper-50 flex items-center px-6 gap-4 shrink-0">
        <button onClick={onCancel} className="eyebrow text-ink-500 hover:text-ink-900 transition">← Back</button>
        <div className="h-5 w-px bg-ink-900/15" />
        <div className="font-display text-lg">Adjust Rooms</div>
        <div className="flex-1" />
        <button
          onClick={() => setDrawing(!drawing)}
          className={`text-[10px] uppercase tracking-editorial px-4 py-1.5 rounded-full border transition ${
            drawing
              ? 'bg-ink-900 text-paper-50 border-ink-900'
              : 'border-ink-900/20 text-ink-700 hover:border-ink-900'
          }`}
        >
          {drawing ? 'Drawing…' : '+ Draw Room'}
        </button>
        <button onClick={handleConfirm} className="btn-ink text-[10px] px-6 py-2">
          Confirm & Open Studio →
        </button>
      </div>

      {/* ── Main area ── */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* ── Canvas ── */}
        <div className="flex-1 min-w-0 overflow-auto flex items-center justify-center p-5 bg-paper-100">
          <div
            className="relative"
            style={{
              width: imageWidth * viewScale,
              height: imageHeight * viewScale,
              cursor: drawing ? 'crosshair' : 'default',
            }}
          >
            {/* Floor plan image */}
            <img
              src={imageUrl}
              alt="Floor plan"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
              draggable={false}
            />

            {/* SVG overlay */}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${imageWidth} ${imageHeight}`}
              className="absolute inset-0 w-full h-full"
              onPointerDown={onSvgPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{ touchAction: 'none' }}
            >
              {/* Zone boxes */}
              {zones.map((z) => {
                const [x1, y1, x2, y2] = z.bbox;
                const w = x2 - x1, h = y2 - y1;
                const isSelected = z.id === selectedId;

                return (
                  <g key={z.id}>
                    {/* Fill */}
                    <rect
                      x={x1} y={y1} width={w} height={h}
                      fill={z.color}
                      fillOpacity={isSelected ? 0.35 : 0.2}
                      stroke={z.color}
                      strokeWidth={isSelected ? 3 / viewScale : 2 / viewScale}
                      strokeDasharray={isSelected ? 'none' : `${6 / viewScale}`}
                      style={{ cursor: drawing ? 'crosshair' : 'move' }}
                      onPointerDown={(e) => !drawing && onPointerDown(e, z.id, 'move')}
                    />
                    {/* Label */}
                    <text
                      x={x1 + 6 / viewScale}
                      y={y1 + 18 / viewScale}
                      fill="#fff"
                      fontSize={13 / viewScale}
                      fontWeight="600"
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)', pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {z.name}
                    </text>
                    {/* Dimension label */}
                    <text
                      x={x1 + 6 / viewScale}
                      y={y1 + 34 / viewScale}
                      fill="#fff"
                      fontSize={10 / viewScale}
                      fontWeight="400"
                      opacity={0.85}
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)', pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {fmtFeetInches(pxToInches(w, scale))} × {fmtFeetInches(pxToInches(h, scale))}
                    </text>

                    {/* Resize handles (only when selected) */}
                    {isSelected && !drawing && getHandles(z.bbox, viewScale).map((hdl, hi) => (
                      <rect
                        key={hi}
                        x={hdl.x} y={hdl.y}
                        width={HANDLE_SIZE / viewScale} height={HANDLE_SIZE / viewScale}
                        fill="#fff" stroke={z.color} strokeWidth={1.5 / viewScale}
                        style={{ cursor: hdl.cursor }}
                        onPointerDown={(e) => onPointerDown(e, z.id, 'resize', hi)}
                      />
                    ))}
                  </g>
                );
              })}

              {/* Drawing preview */}
              {drawRect && (
                <rect
                  x={drawRect.x} y={drawRect.y}
                  width={drawRect.w} height={drawRect.h}
                  fill={ROOM_ZONE_COLORS[zones.length % ROOM_ZONE_COLORS.length]}
                  fillOpacity={0.25}
                  stroke={ROOM_ZONE_COLORS[zones.length % ROOM_ZONE_COLORS.length]}
                  strokeWidth={2 / viewScale}
                  strokeDasharray={`${4 / viewScale}`}
                />
              )}
            </svg>
          </div>
        </div>

        {/* ── Right panel: room list + editor ── */}
        <aside className="w-[340px] border-l border-ink-900/10 bg-paper-50 flex flex-col shrink-0 overflow-hidden">
          <div className="p-6 border-b border-ink-900/10">
            <div className="eyebrow mb-1">Detected Rooms</div>
            <p className="text-xs text-ink-500 leading-relaxed">
              {zones.length} room{zones.length !== 1 ? 's' : ''} detected. Click a room to select, drag to reposition, handles to resize. Use "Draw Room" to add missing rooms.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {zones.map((z, i) => {
              const [x1, y1, x2, y2] = z.bbox;
              const wIn = pxToInches(x2 - x1, scale);
              const hIn = pxToInches(y2 - y1, scale);
              const isSelected = z.id === selectedId;
              const isEditing = editPanel === z.id;

              return (
                <div
                  key={z.id}
                  className={`border transition rounded-lg overflow-hidden ${
                    isSelected ? 'border-ink-900 shadow-sm' : 'border-ink-900/10 hover:border-ink-900/30'
                  }`}
                >
                  {/* Room header */}
                  <button
                    className="w-full flex items-center gap-3 p-3 text-left"
                    onClick={() => { setSelectedId(z.id); setEditPanel(isEditing ? null : z.id); }}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: z.color }}
                    />
                    <span className="flex-1 text-sm font-medium text-ink-900 truncate">{z.name}</span>
                    <span className="text-[10px] text-ink-500 uppercase tracking-editorial shrink-0">
                      {fmtFeetInches(wIn)} × {fmtFeetInches(hIn)}
                    </span>
                    <span className="text-ink-400 text-xs">{isEditing ? '▲' : '▼'}</span>
                  </button>

                  {/* Expanded editor */}
                  <AnimatePresence>
                    {isEditing && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 space-y-3 border-t border-ink-900/5 pt-3">
                          {/* Name */}
                          <label className="block">
                            <div className="text-[10px] uppercase tracking-editorial text-ink-500 mb-1">Room Name</div>
                            <input
                              className="input-field text-sm"
                              value={z.name}
                              onChange={(e) => updateZoneName(z.id, e.target.value)}
                            />
                          </label>

                          {/* Width */}
                          <label className="block">
                            <div className="text-[10px] uppercase tracking-editorial text-ink-500 mb-1">
                              Width <span className="text-ink-400">(feet'inches")</span>
                            </div>
                            <input
                              className="input-field text-sm"
                              defaultValue={fmtFeetInches(wIn)}
                              onBlur={(e) => updateZoneDimension(z.id, 'width', e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && updateZoneDimension(z.id, 'width', e.target.value)}
                              placeholder="12'6&quot;"
                            />
                          </label>

                          {/* Depth */}
                          <label className="block">
                            <div className="text-[10px] uppercase tracking-editorial text-ink-500 mb-1">
                              Depth <span className="text-ink-400">(feet'inches")</span>
                            </div>
                            <input
                              className="input-field text-sm"
                              defaultValue={fmtFeetInches(hIn)}
                              onBlur={(e) => updateZoneDimension(z.id, 'depth', e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && updateZoneDimension(z.id, 'depth', e.target.value)}
                              placeholder="10'0&quot;"
                            />
                          </label>

                          {/* Color */}
                          <div>
                            <div className="text-[10px] uppercase tracking-editorial text-ink-500 mb-1.5">Color</div>
                            <div className="flex gap-1.5 flex-wrap">
                              {ROOM_ZONE_COLORS.map(c => (
                                <button
                                  key={c}
                                  onClick={() => setZones(prev => prev.map(zone => zone.id === z.id ? { ...zone, color: c } : zone))}
                                  className={`w-5 h-5 rounded-full border-2 transition ${z.color === c ? 'border-ink-900 scale-110' : 'border-transparent hover:border-ink-900/30'}`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Delete */}
                          <button
                            onClick={() => removeZone(z.id)}
                            className="w-full text-[10px] uppercase tracking-editorial py-2 rounded-full border border-red-300 text-red-600 hover:bg-red-600 hover:text-white transition"
                          >
                            Remove Room
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {zones.length === 0 && (
              <div className="text-center py-10">
                <p className="text-ink-500 text-sm mb-4">No rooms detected.</p>
                <button
                  onClick={() => setDrawing(true)}
                  className="btn-ink text-[10px] px-6 py-2"
                >
                  + Draw a Room
                </button>
              </div>
            )}
          </div>

          {/* Bottom summary */}
          <div className="p-4 border-t border-ink-900/10 bg-paper-100">
            <div className="flex items-center justify-between mb-3">
              <span className="eyebrow text-ink-500">{zones.length} rooms</span>
              {zones.length > 0 && (
                <span className="text-[10px] text-ink-400">
                  Scale: 1px = {(1 / scale).toFixed(2)}"
                </span>
              )}
            </div>
            <button onClick={handleConfirm} className="btn-ink w-full text-[10px] py-2.5">
              Confirm & Open Studio →
            </button>
          </div>
        </aside>
      </div>
    </motion.div>
  );
}
