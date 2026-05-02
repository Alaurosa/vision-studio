import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ROOM_ZONE_COLORS, getZoneColor } from '@/utils/constants';

/* ─── helpers ─── */

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

const MIN_BOX = 20;

function bboxFromPolygon(polygon) {
  const xs = polygon.map(p => p[0]);
  const ys = polygon.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function initZones(zones) {
  return (zones || []).map((z, i) => {
    const polygon = z.polygon && z.polygon.length >= 3 ? z.polygon : null;
    const bbox = z.bbox && z.bbox.length === 4 ? [...z.bbox] : (polygon ? bboxFromPolygon(polygon) : [0, 0, 100, 100]);
    return {
      id: z.id || `zone-${i}`,
      name: z.name || z.label || `Room ${i + 1}`,
      bbox,
      polygon,
      color: getZoneColor(i),
      confidence: z.confidence ?? null,
      widthIn: z.width_inches || null,
      depthIn: z.depth_inches || null,
    };
  });
}

function pxToInches(px, scale) { return scale > 0 ? px / scale : px; }

function fmtFeetInches(totalInches) {
  if (totalInches == null) return '—';
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

function parseFeetInches(str) {
  const s = str.trim().replace(/ft/gi, "'").replace(/in/gi, '"').replace(/,/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)\s*['′]?\s*(\d+(?:\.\d+)?)?\s*["″]?\s*$/);
  if (m) {
    const feet = parseFloat(m[1]) || 0;
    const inches = parseFloat(m[2]) || 0;
    return feet * 12 + inches;
  }
  const n = parseFloat(s);
  if (!isNaN(n)) return n;
  return null;
}

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

export default function RoomEditor({
  imageUrl, imageWidth, imageHeight, initialZones, boundary, scalePxPerInch, onConfirm, onCancel,
}) {
  const [zones, setZones] = useState(() => initZones(initialZones));
  const [selectedId, setSelectedId] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState('rect'); // 'rect' or 'polygon'
  const [drawStart, setDrawStart] = useState(null);
  const [drawEnd, setDrawEnd] = useState(null);
  const [polyPoints, setPolyPoints] = useState([]); // vertices for polygon drawing
  const [editPanel, setEditPanel] = useState(null);
  const [dragState, setDragState] = useState(null);

  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const [viewScale, setViewScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      if (!containerRef.current || !imageWidth || !imageHeight) return;
      const cw = containerRef.current.clientWidth - 360;
      const ch = containerRef.current.clientHeight - 40;
      setViewScale(Math.max(0.15, Math.min(cw / imageWidth, ch / imageHeight, 1)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [imageWidth, imageHeight]);

  const scale = scalePxPerInch || 1;

  const mouseToImg = useCallback((e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (e.clientX - rect.left) / viewScale, y: (e.clientY - rect.top) / viewScale };
  }, [viewScale]);

  /* ── drag / resize — does NOT touch widthIn/depthIn ── */
  const onPointerDown = useCallback((e, zoneId, type, handleIdx) => {
    e.stopPropagation();
    e.preventDefault();
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;
    setSelectedId(zoneId);
    setDragState({ zoneId, type, handleIdx, startMouse: mouseToImg(e), startBbox: [...zone.bbox] });
  }, [zones, mouseToImg]);

  const onPointerMove = useCallback((e) => {
    if (drawing && drawStart) { setDrawEnd(mouseToImg(e)); return; }
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
        x1 = clamp(ox1 + dx, 0, imageWidth - w); y1 = clamp(oy1 + dy, 0, imageHeight - h);
        x2 = x1 + w; y2 = y1 + h;
      } else {
        const handles = getHandles(dragState.startBbox, viewScale);
        const h = handles[dragState.handleIdx];
        if (h.dx < 0) x1 = clamp(ox1 + dx, 0, ox2 - MIN_BOX);
        if (h.dx > 0) x2 = clamp(ox2 + dx, ox1 + MIN_BOX, imageWidth);
        if (h.dy < 0) y1 = clamp(oy1 + dy, 0, oy2 - MIN_BOX);
        if (h.dy > 0) y2 = clamp(oy2 + dy, oy1 + MIN_BOX, imageHeight);
      }
      // Only update bbox — widthIn/depthIn stay untouched
      return { ...z, bbox: [x1, y1, x2, y2] };
    }));
  }, [dragState, drawing, drawStart, mouseToImg, imageWidth, imageHeight, viewScale]);

  const onPointerUp = useCallback(() => {
    if (drawing && drawStart && drawEnd) {
      const x1 = Math.min(drawStart.x, drawEnd.x), y1 = Math.min(drawStart.y, drawEnd.y);
      const x2 = Math.max(drawStart.x, drawEnd.x), y2 = Math.max(drawStart.y, drawEnd.y);
      if (x2 - x1 > MIN_BOX && y2 - y1 > MIN_BOX) {
        const newZone = {
          id: `zone-${Date.now()}`, name: `Space ${zones.length + 1}`,
          bbox: [x1, y1, x2, y2], color: getZoneColor(zones.length),
          confidence: null, widthIn: null, depthIn: null,
        };
        setZones(prev => [...prev, newZone]);
        setSelectedId(newZone.id);
      }
      setDrawStart(null); setDrawEnd(null); setDrawing(false);
      return;
    }
    setDragState(null);
  }, [drawing, drawStart, drawEnd, zones.length]);

  const onSvgPointerDown = useCallback((e) => {
    if (drawing && drawMode === 'rect') { const pos = mouseToImg(e); setDrawStart(pos); setDrawEnd(pos); return; }
    if (drawing && drawMode === 'polygon') {
      const pos = mouseToImg(e);
      setPolyPoints(prev => [...prev, [pos.x, pos.y]]);
      return;
    }
    setSelectedId(null);
  }, [drawing, drawMode, mouseToImg]);

  /* ── zone actions ── */
  const finishPolygon = () => {
    if (polyPoints.length < 3) { setPolyPoints([]); return; }
    const polygon = polyPoints.map(([x, y]) => [Math.round(x), Math.round(y)]);
    const bbox = bboxFromPolygon(polygon);
    const newZone = {
      id: `zone-${Date.now()}`, name: `Room ${zones.length + 1}`,
      bbox, polygon, color: getZoneColor(zones.length),
      confidence: null, widthIn: null, depthIn: null,
    };
    setZones(prev => [...prev, newZone]);
    setSelectedId(newZone.id);
    setPolyPoints([]);
    setDrawing(false);
  };
  const removeZone = (id) => {
    setZones(prev => prev.filter(z => z.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editPanel === id) setEditPanel(null);
  };

  const updateZoneName = (id, name) => setZones(prev => prev.map(z => z.id === id ? { ...z, name } : z));
  const updateZoneColor = (id, color) => setZones(prev => prev.map(z => z.id === id ? { ...z, color } : z));

  /* Dimension update — only changes the stored widthIn/depthIn, does NOT resize the box */
  const updateZoneDimension = (id, field, valueStr) => {
    const inches = parseFeetInches(valueStr);
    if (inches == null || inches <= 0) return;
    setZones(prev => prev.map(z => {
      if (z.id !== id) return z;
      return field === 'width' ? { ...z, widthIn: inches } : { ...z, depthIn: inches };
    }));
  };

  /* ── confirm — uses user-entered dimensions if available, else falls back to pixel calc ── */
  const handleConfirm = () => {
    const finalZones = zones.map((z) => {
      const [x1, y1, x2, y2] = z.bbox;
      const wPx = x2 - x1, hPx = y2 - y1;
      // Use the actual polygon if available, otherwise generate from bbox
      const polygon = (z.polygon && z.polygon.length >= 3)
        ? z.polygon.map(([x, y]) => [Math.round(x), Math.round(y)])
        : [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(([x, y]) => [Math.round(x), Math.round(y)]);
      return {
        id: z.id, name: z.name, color: z.color,
        bbox: z.bbox.map(v => Math.round(v)),
        polygon,
        width: z.widthIn ? Math.round(z.widthIn) : Math.round(pxToInches(wPx, scale)),
        depth: z.depthIn ? Math.round(z.depthIn) : Math.round(pxToInches(hPx, scale)),
      };
    });
    onConfirm(finalZones);
  };

  const drawRect = useMemo(() => {
    if (!drawStart || !drawEnd) return null;
    return { x: Math.min(drawStart.x, drawEnd.x), y: Math.min(drawStart.y, drawEnd.y),
      w: Math.abs(drawEnd.x - drawStart.x), h: Math.abs(drawEnd.y - drawStart.y) };
  }, [drawStart, drawEnd]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-paper-50 flex flex-col">
      {/* Top bar */}
      <div className="h-14 border-b border-ink-900/10 bg-paper-50 flex items-center px-6 gap-4 shrink-0">
        <button onClick={onCancel} className="eyebrow text-ink-500 hover:text-ink-900 transition">← Back</button>
        <div className="h-5 w-px bg-ink-900/15" />
        <div className="font-display text-lg">Adjust Spaces</div>
        <div className="flex-1" />
        <button onClick={() => { setDrawing(!drawing); setDrawMode('rect'); setPolyPoints([]); }}
          className={`text-[10px] uppercase tracking-editorial px-4 py-1.5 rounded-full border transition ${
            drawing && drawMode === 'rect' ? 'bg-ink-900 text-paper-50 border-ink-900' : 'border-ink-900/20 text-ink-700 hover:border-ink-900'}`}>
          {drawing && drawMode === 'rect' ? 'Drawing…' : '+ Rectangle'}
        </button>
        <button onClick={() => { setDrawing(!drawing); setDrawMode('polygon'); setPolyPoints([]); setDrawStart(null); setDrawEnd(null); }}
          className={`text-[10px] uppercase tracking-editorial px-4 py-1.5 rounded-full border transition ${
            drawing && drawMode === 'polygon' ? 'bg-sienna-500 text-paper-50 border-sienna-500' : 'border-ink-900/20 text-ink-700 hover:border-ink-900'}`}>
          {drawing && drawMode === 'polygon' ? `${polyPoints.length} pts` : '+ Polygon'}
        </button>
        {drawing && drawMode === 'polygon' && polyPoints.length >= 3 && (
          <button onClick={finishPolygon}
            className="text-[10px] uppercase tracking-editorial px-4 py-1.5 rounded-full border bg-emerald-600 text-paper-50 border-emerald-600 hover:bg-emerald-700 transition">
            Close Shape ✓
          </button>
        )}
        <button onClick={handleConfirm} className="btn-ink text-[10px] px-6 py-2">Confirm & Open Studio →</button>
      </div>

      {/* Main area */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 min-w-0 overflow-auto flex items-center justify-center p-5 bg-paper-100">
          <div className="relative" style={{ width: imageWidth * viewScale, height: imageHeight * viewScale, cursor: drawing ? 'crosshair' : 'default' }}>
            <img src={imageUrl} alt="Floor plan" className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none" draggable={false} />
            <svg ref={svgRef} viewBox={`0 0 ${imageWidth} ${imageHeight}`} className="absolute inset-0 w-full h-full"
              onPointerDown={onSvgPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} style={{ touchAction: 'none' }}>
{zones.map((z) => {
                const [x1, y1, x2, y2] = z.bbox;
                const w = x2 - x1, h = y2 - y1;
                const isSelected = z.id === selectedId;
                const hasPolygon = z.polygon && z.polygon.length >= 3;
                const polyPoints = hasPolygon ? z.polygon.map(p => p.join(',')).join(' ') : null;
                return (
                  <g key={z.id}>
                    {hasPolygon ? (
                      <polygon points={polyPoints} fill={z.color}
                        fillOpacity={isSelected ? 0.35 : 0.2} stroke={z.color}
                        strokeWidth={isSelected ? 3 / viewScale : 2 / viewScale}
                        strokeDasharray={isSelected ? 'none' : `${6 / viewScale}`}
                        style={{ cursor: drawing ? 'crosshair' : 'move' }}
                        onPointerDown={(e) => !drawing && onPointerDown(e, z.id, 'move')} />
                    ) : (
                      <rect x={x1} y={y1} width={w} height={h} fill={z.color}
                        fillOpacity={isSelected ? 0.35 : 0.2} stroke={z.color}
                        strokeWidth={isSelected ? 3 / viewScale : 2 / viewScale}
                        strokeDasharray={isSelected ? 'none' : `${6 / viewScale}`}
                        style={{ cursor: drawing ? 'crosshair' : 'move' }}
                        onPointerDown={(e) => !drawing && onPointerDown(e, z.id, 'move')} />
                    )}
                    <text x={x1 + 6 / viewScale} y={y1 + 18 / viewScale} fill="#fff" fontSize={13 / viewScale} fontWeight="600"
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)', pointerEvents: 'none', userSelect: 'none' }}>{z.name}</text>
                    <text x={x1 + 6 / viewScale} y={y1 + 34 / viewScale} fill="#fff" fontSize={10 / viewScale} fontWeight="400" opacity={0.85}
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)', pointerEvents: 'none', userSelect: 'none' }}>
                      {z.widthIn ? fmtFeetInches(z.widthIn) : fmtFeetInches(pxToInches(w, scale))} \u00d7 {z.depthIn ? fmtFeetInches(z.depthIn) : fmtFeetInches(pxToInches(h, scale))}
                    </text>
                    {isSelected && !drawing && !hasPolygon && getHandles(z.bbox, viewScale).map((hdl, hi) => (
                      <rect key={hi} x={hdl.x} y={hdl.y} width={HANDLE_SIZE / viewScale} height={HANDLE_SIZE / viewScale}
                        fill="#fff" stroke={z.color} strokeWidth={1.5 / viewScale} style={{ cursor: hdl.cursor }}
                        onPointerDown={(e) => onPointerDown(e, z.id, 'resize', hi)} />
                    ))}
                    {isSelected && !drawing && hasPolygon && z.polygon.map((pt, pi) => (
                      <circle key={pi} cx={pt[0]} cy={pt[1]} r={4 / viewScale}
                        fill="#fff" stroke={z.color} strokeWidth={1.5 / viewScale}
                        style={{ cursor: 'move' }} />
                    ))}
                  </g>
                );
              })}
              {drawRect && drawMode === 'rect' && (
                <rect x={drawRect.x} y={drawRect.y} width={drawRect.w} height={drawRect.h}
                  fill={getZoneColor(zones.length)} fillOpacity={0.25} stroke={getZoneColor(zones.length)}
                  strokeWidth={2 / viewScale} strokeDasharray={`${4 / viewScale}`} />
              )}
              {/* Polygon drawing preview */}
              {polyPoints.length > 0 && (
                <g>
                  <polyline
                    points={polyPoints.map(p => p.join(',')).join(' ')}
                    fill="none" stroke={getZoneColor(zones.length)}
                    strokeWidth={2 / viewScale} strokeDasharray={`${4 / viewScale}`} />
                  {polyPoints.length >= 3 && (
                    <polygon
                      points={polyPoints.map(p => p.join(',')).join(' ')}
                      fill={getZoneColor(zones.length)} fillOpacity={0.15}
                      stroke="none" />
                  )}
                  {polyPoints.map((pt, i) => (
                    <circle key={i} cx={pt[0]} cy={pt[1]} r={5 / viewScale}
                      fill={i === 0 ? '#fff' : getZoneColor(zones.length)}
                      stroke={getZoneColor(zones.length)} strokeWidth={2 / viewScale}
                      style={{ cursor: i === 0 && polyPoints.length >= 3 ? 'pointer' : 'default' }}
                      onPointerDown={(e) => { if (i === 0 && polyPoints.length >= 3) { e.stopPropagation(); finishPolygon(); } }} />
                  ))}
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Right panel */}
        <aside className="w-[340px] border-l border-ink-900/10 bg-paper-50 flex flex-col shrink-0 overflow-hidden">
          <div className="p-6 border-b border-ink-900/10">
            <div className="eyebrow mb-1">Detected Spaces</div>
            <p className="text-xs text-ink-500 leading-relaxed">
              {zones.length} space{zones.length !== 1 ? 's' : ''} detected. Drag to reposition, handles to resize. Dimensions are independent of the box position.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {zones.map((z) => {
              const [x1, y1, x2, y2] = z.bbox;
              const wIn = z.widthIn || pxToInches(x2 - x1, scale);
              const hIn = z.depthIn || pxToInches(y2 - y1, scale);
              const isSelected = z.id === selectedId;
              const isEditing = editPanel === z.id;

              return (
                <div key={z.id} className={`border transition rounded-lg overflow-hidden ${isSelected ? 'border-ink-900 shadow-sm' : 'border-ink-900/10 hover:border-ink-900/30'}`}>
                  <button className="w-full flex items-center gap-3 p-3 text-left"
                    onClick={() => { setSelectedId(z.id); setEditPanel(isEditing ? null : z.id); }}>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: z.color }} />
                    <span className="flex-1 text-sm font-medium text-ink-900 truncate">{z.name}</span>
                    <span className="text-[10px] text-ink-500 uppercase tracking-editorial shrink-0">
                      {fmtFeetInches(wIn)} × {fmtFeetInches(hIn)}
                    </span>
                    <span className="text-ink-400 text-xs">{isEditing ? '▲' : '▼'}</span>
                  </button>

                  <AnimatePresence>
                    {isEditing && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="px-3 pb-3 space-y-3 border-t border-ink-900/5 pt-3">
                          <label className="block">
                            <div className="text-[10px] uppercase tracking-editorial text-ink-500 mb-1">Space Name</div>
                            <input className="input-field text-sm" value={z.name} onChange={(e) => updateZoneName(z.id, e.target.value)} />
                          </label>

                          <label className="block">
                            <div className="text-[10px] uppercase tracking-editorial text-ink-500 mb-1">Width <span className="text-ink-400">(feet'inches")</span></div>
                            <input className="input-field text-sm" defaultValue={z.widthIn ? fmtFeetInches(z.widthIn) : fmtFeetInches(pxToInches(x2 - x1, scale))}
                              onBlur={(e) => updateZoneDimension(z.id, 'width', e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && updateZoneDimension(z.id, 'width', e.target.value)} placeholder="12'6&quot;" />
                          </label>

                          <label className="block">
                            <div className="text-[10px] uppercase tracking-editorial text-ink-500 mb-1">Depth <span className="text-ink-400">(feet'inches")</span></div>
                            <input className="input-field text-sm" defaultValue={z.depthIn ? fmtFeetInches(z.depthIn) : fmtFeetInches(pxToInches(y2 - y1, scale))}
                              onBlur={(e) => updateZoneDimension(z.id, 'depth', e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && updateZoneDimension(z.id, 'depth', e.target.value)} placeholder="10'0&quot;" />
                          </label>

                          {/* Color: preset swatches + native color picker */}
                          <div>
                            <div className="text-[10px] uppercase tracking-editorial text-ink-500 mb-1.5">Color</div>
                            <div className="flex gap-1.5 flex-wrap items-center">
                              {ROOM_ZONE_COLORS.slice(0, 8).map(c => (
                                <button key={c} onClick={() => updateZoneColor(z.id, c)}
                                  className={`w-5 h-5 rounded-full border-2 transition ${z.color === c ? 'border-ink-900 scale-110' : 'border-transparent hover:border-ink-900/30'}`}
                                  style={{ backgroundColor: c }} />
                              ))}
                              <label className="w-5 h-5 rounded-full border-2 border-dashed border-ink-900/30 cursor-pointer overflow-hidden relative hover:border-ink-900/60 transition" title="Custom color">
                                <input type="color" value={z.color} onChange={(e) => updateZoneColor(z.id, e.target.value)}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <span className="absolute inset-0 grid place-items-center text-[8px] text-ink-500 font-bold">+</span>
                              </label>
                            </div>
                          </div>

                          <button onClick={() => removeZone(z.id)}
                            className="w-full text-[10px] uppercase tracking-editorial py-2 rounded-full border border-red-300 text-red-600 hover:bg-red-600 hover:text-white transition">
                            Remove Space
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
                <p className="text-ink-500 text-sm mb-4">No spaces detected.</p>
                <button onClick={() => setDrawing(true)} className="btn-ink text-[10px] px-6 py-2">+ Draw a Space</button>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-ink-900/10 bg-paper-100">
            <div className="flex items-center justify-between mb-3">
              <span className="eyebrow text-ink-500">{zones.length} spaces</span>
            </div>
            <button onClick={handleConfirm} className="btn-ink w-full text-[10px] py-2.5">Confirm & Open Studio →</button>
          </div>
        </aside>
      </div>
    </motion.div>
  );
}
