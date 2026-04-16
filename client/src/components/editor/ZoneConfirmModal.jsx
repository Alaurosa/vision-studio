import { useState, useRef, useEffect } from 'react';
import { useLayoutStore } from '../../store/layoutStore';

const ZONE_PALETTE = [
  '#f59e0b', '#10b981', '#3b82f6', '#ec4899',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316',
];

let _slugCounter = 0;
function slugId() {
  return `zone-${Date.now().toString(36)}-${_slugCounter++}`;
}

// Compute polygon width/depth in image pixels from a list of [x,y] points
function polygonSize(polygon) {
  if (!polygon || polygon.length === 0) return { width: 0, depth: 0, minX: 0, minY: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of polygon) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { width: maxX - minX, depth: maxY - minY, minX, minY };
}

// Convert hex color to rgba string
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Modal shown after floor plan analysis.
 * Shows the floor plan image with colored zone overlays, alongside an editable room list.
 */
export default function ZoneConfirmModal({ detectedRooms, onClose, imageScale, imageWidth, imageHeight, floorPlanUrl }) {
  const saveZones = useLayoutStore((s) => s.saveZones);
  const setActiveZone = useLayoutStore((s) => s.setActiveZone);
  const imgContainerRef = useRef(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [hoveredId, setHoveredId] = useState(null);

  // Seed draft state from parser output
  const [drafts, setDrafts] = useState(() =>
    detectedRooms.map((r, i) => {
      const { width, depth, minX, minY } = polygonSize(r.polygon);
      const widthInches = imageScale ? Math.round(width / imageScale) : '';
      const depthInches = imageScale ? Math.round(depth / imageScale) : '';
      return {
        id: slugId(),
        name: r.label && r.label !== 'room' ? r.label : `Room ${i + 1}`,
        color: ZONE_PALETTE[i % ZONE_PALETTE.length],
        polygon: r.polygon || [],
        bbox: r.bbox || null,
        confidence: r.confidence || 0,
        _imgWidth: width,
        _imgDepth: depth,
        _imgMinX: minX,
        _imgMinY: minY,
        widthInches: widthInches || 120,
        depthInches: depthInches || 120,
        included: true,
        manual: false,
      };
    })
  );

  const [saving, setSaving] = useState(false);

  // Track the rendered image size for overlay scaling
  useEffect(() => {
    if (!imgContainerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        setDisplaySize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    obs.observe(imgContainerRef.current);
    return () => obs.disconnect();
  }, []);

  const handleImageLoad = (e) => {
    setDisplaySize({ w: e.target.clientWidth, h: e.target.clientHeight });
  };

  // Compute scale from original image pixels → rendered display pixels
  const scaleX = imageWidth && displaySize.w ? displaySize.w / imageWidth : 1;
  const scaleY = imageHeight && displaySize.h ? displaySize.h / imageHeight : 1;

  const toggleIncluded = (id) =>
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, included: !d.included } : d)));

  const updateField = (id, field, value) =>
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));

  const updateDimension = (id, field, value) => {
    const num = parseInt(value, 10);
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: isNaN(num) ? '' : num } : d)));
  };

  const addRoom = () => {
    const idx = drafts.length;
    setDrafts((prev) => [
      ...prev,
      {
        id: slugId(),
        name: `Room ${idx + 1}`,
        color: ZONE_PALETTE[idx % ZONE_PALETTE.length],
        polygon: [],
        bbox: null,
        confidence: 0,
        _imgWidth: 0,
        _imgDepth: 0,
        _imgMinX: 0,
        _imgMinY: 0,
        widthInches: 120,
        depthInches: 120,
        included: true,
        manual: true,
      },
    ]);
  };

  const removeRoom = (id) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSave = async () => {
    const included = drafts.filter((d) => d.included);
    if (included.length === 0) {
      onClose(false);
      return;
    }
    setSaving(true);
    const zones = included.map((d) => {
      const w = typeof d.widthInches === 'number' && d.widthInches > 0 ? d.widthInches : null;
      const dep = typeof d.depthInches === 'number' && d.depthInches > 0 ? d.depthInches : null;
      let polygon = d.polygon;
      if ((!polygon || polygon.length === 0) && w && dep && imageScale) {
        const pxW = w * imageScale;
        const pxD = dep * imageScale;
        const ox = d._imgMinX || 10;
        const oy = d._imgMinY || 10;
        polygon = [[ox, oy], [ox + pxW, oy], [ox + pxW, oy + pxD], [ox, oy + pxD]];
      }
      return {
        id: d.id,
        name: d.name,
        color: d.color,
        polygon: polygon || [],
        bbox: d.bbox,
        confidence: d.confidence,
        width: w,
        depth: dep,
      };
    });
    await saveZones(zones);
    setActiveZone(zones[0].id);
    setSaving(false);
    onClose(true);
  };

  const handleSkip = () => onClose(false);

  const includedCount = drafts.filter((d) => d.included).length;

  // Build SVG overlay polygons for each included zone
  const buildOverlayPolygon = (d) => {
    if (!d.polygon || d.polygon.length < 3) return null;
    const points = d.polygon.map(([x, y]) => `${x * scaleX},${y * scaleY}`).join(' ');
    return points;
  };

  // Build bbox rect for zones that only have bbox (normalized 0-1)
  const buildOverlayRect = (d) => {
    if (!d.bbox || d.bbox.length < 4) return null;
    const [x1, y1, x2, y2] = d.bbox;
    return {
      x: x1 * displaySize.w,
      y: y1 * displaySize.h,
      w: (x2 - x1) * displaySize.w,
      h: (y2 - y1) * displaySize.h,
    };
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900/70 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {detectedRooms.length > 0
              ? `${detectedRooms.length} room${detectedRooms.length !== 1 ? 's' : ''} detected`
              : 'Define Your Rooms'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {detectedRooms.length > 0
              ? 'Review the detected rooms on the floor plan. Adjust names, dimensions, and toggle rooms on or off.'
              : 'No rooms were detected automatically. Add rooms manually and set their dimensions.'}
          </p>
        </div>

        {/* Main content: floor plan overlay + room list side by side */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Left: Floor plan with zone overlays */}
          <div className="flex-1 min-w-0 p-4 flex items-center justify-center bg-slate-900 border-r border-white/10">
            {floorPlanUrl ? (
              <div className="relative inline-block max-w-full max-h-full" ref={imgContainerRef}>
                <img
                  src={floorPlanUrl}
                  alt="Floor plan"
                  onLoad={handleImageLoad}
                  className="max-w-full max-h-[65vh] rounded-lg shadow-sm object-contain block"
                  draggable={false}
                />
                {/* SVG overlay for zone boxes */}
                {displaySize.w > 0 && (
                  <svg
                    className="absolute top-0 left-0 pointer-events-none"
                    width={displaySize.w}
                    height={displaySize.h}
                    style={{ overflow: 'visible' }}
                  >
                    {drafts.filter(d => d.included).map((d) => {
                      const isHovered = hoveredId === d.id;
                      const fillOpacity = isHovered ? 0.3 : 0.18;
                      const strokeWidth = isHovered ? 3 : 2;
                      const polyPoints = buildOverlayPolygon(d);
                      const bboxRect = !polyPoints ? buildOverlayRect(d) : null;

                      return (
                        <g key={d.id}>
                          {polyPoints && (
                            <polygon
                              points={polyPoints}
                              fill={hexToRgba(d.color, fillOpacity)}
                              stroke={d.color}
                              strokeWidth={strokeWidth}
                              strokeDasharray={isHovered ? 'none' : '6 3'}
                            />
                          )}
                          {bboxRect && (
                            <rect
                              x={bboxRect.x}
                              y={bboxRect.y}
                              width={bboxRect.w}
                              height={bboxRect.h}
                              fill={hexToRgba(d.color, fillOpacity)}
                              stroke={d.color}
                              strokeWidth={strokeWidth}
                              strokeDasharray={isHovered ? 'none' : '6 3'}
                              rx={4}
                            />
                          )}
                          {/* Zone label on the overlay */}
                          {(() => {
                            let cx, cy;
                            if (polyPoints) {
                              const pts = d.polygon;
                              cx = pts.reduce((s, p) => s + p[0], 0) / pts.length * scaleX;
                              cy = pts.reduce((s, p) => s + p[1], 0) / pts.length * scaleY;
                            } else if (bboxRect) {
                              cx = bboxRect.x + bboxRect.w / 2;
                              cy = bboxRect.y + bboxRect.h / 2;
                            } else {
                              return null;
                            }
                            return (
                              <>
                                <rect
                                  x={cx - 40}
                                  y={cy - 10}
                                  width={80}
                                  height={20}
                                  rx={4}
                                  fill={d.color}
                                  opacity={0.85}
                                />
                                <text
                                  x={cx}
                                  y={cy + 4}
                                  textAnchor="middle"
                                  fill="white"
                                  fontSize={11}
                                  fontWeight={600}
                                >
                                  {d.name}
                                </text>
                              </>
                            );
                          })()}
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>
            ) : (
              <div className="text-center text-slate-500 py-12">
                <div className="text-4xl mb-3">🏠</div>
                <p className="text-sm">No floor plan preview available</p>
              </div>
            )}
          </div>

          {/* Right: Room list */}
          <div className="w-80 shrink-0 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Rooms</span>
              <button
                onClick={addRoom}
                disabled={saving}
                className="text-xs text-blue-400 hover:text-blue-400 font-medium px-2 py-1 rounded hover:bg-blue-500/10 transition"
              >
                + Add Room
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              {drafts.length === 0 && (
                <div className="text-center py-6 text-slate-500">
                  <p className="text-sm">No rooms yet. Click "+ Add Room" to get started.</p>
                </div>
              )}

              {drafts.map((d, i) => (
                <div
                  key={d.id}
                  className={`rounded-xl border transition cursor-pointer ${
                    d.included
                      ? hoveredId === d.id
                        ? 'border-slate-700 bg-slate-900 ring-1 ring-slate-700'
                        : 'border-white/10 bg-slate-900/70'
                      : 'border-white/10 bg-slate-900 opacity-50'
                  }`}
                  onMouseEnter={() => setHoveredId(d.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Top row: checkbox, color dot, name, confidence, remove */}
                  <div className="flex items-center gap-2 p-2.5 pb-1.5">
                    <input
                      type="checkbox"
                      checked={d.included}
                      onChange={() => toggleIncluded(d.id)}
                      className="w-3.5 h-3.5 rounded accent-slate-800 shrink-0"
                    />
                    <div
                      className="w-4 h-4 rounded-full shrink-0 border border-white shadow-sm"
                      style={{ background: d.color }}
                    />
                    <input
                      type="text"
                      value={d.name}
                      onChange={(e) => updateField(d.id, 'name', e.target.value)}
                      placeholder={`Room ${i + 1}`}
                      disabled={!d.included}
                      className="flex-1 min-w-0 border border-white/10 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-900"
                    />
                    {d.confidence > 0 && (
                      <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
                        {Math.round(d.confidence * 100)}%
                      </span>
                    )}
                    {d.manual && (
                      <span className="text-[9px] font-medium text-blue-500 bg-blue-500/10 px-1 py-0.5 rounded shrink-0">
                        Manual
                      </span>
                    )}
                    <button
                      onClick={() => removeRoom(d.id)}
                      className="text-slate-600 hover:text-red-400 transition shrink-0"
                      title="Remove room"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Dimension row */}
                  {d.included && (
                    <div className="flex items-center gap-1.5 px-2.5 pb-2.5 pl-8">
                      <label className="text-[10px] text-slate-400 shrink-0">W</label>
                      <input
                        type="number"
                        value={d.widthInches}
                        onChange={(e) => updateDimension(d.id, 'widthInches', e.target.value)}
                        min={1}
                        className="w-16 border border-white/10 rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <span className="text-[10px] text-slate-500">″</span>
                      <span className="text-slate-600 mx-0.5">×</span>
                      <label className="text-[10px] text-slate-400 shrink-0">D</label>
                      <input
                        type="number"
                        value={d.depthInches}
                        onChange={(e) => updateDimension(d.id, 'depthInches', e.target.value)}
                        min={1}
                        className="w-16 border border-white/10 rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <span className="text-[10px] text-slate-500">″</span>
                      <input
                        type="color"
                        value={d.color}
                        onChange={(e) => updateField(d.id, 'color', e.target.value)}
                        className="w-5 h-5 rounded-full border border-white/10 cursor-pointer shrink-0 ml-auto"
                        title="Room color"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 flex justify-between items-center gap-3">
          <button
            onClick={handleSkip}
            disabled={saving}
            className="text-sm text-slate-400 hover:text-slate-200 transition"
          >
            Skip — treat as single space
          </button>
          <button
            onClick={handleSave}
            disabled={saving || includedCount === 0}
            className="bg-slate-800 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-slate-700 transition disabled:opacity-50"
          >
            {saving
              ? 'Saving…'
              : `Confirm ${includedCount} room${includedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
