import { useMemo, useState } from 'react';
import { projectFloorplanOverlays, toBboxArray } from '@/utils/floorplanGeometry';

export default function ProjectCanvas({
  project = null,
  projectSpaces = [],
  selectedSpaceId = null,
  onSelectSpace,
}) {
  const [colorOverlay, setColorOverlay] = useState(true);
  const { imageUrl, overlays, bounds } = useMemo(() => projectFloorplanOverlays(project), [project]);
  const fallback = Array.isArray(projectSpaces) && projectSpaces.length > 0;

  return (
    <div className="relative h-full w-full bg-surface-800">
      <div className="absolute right-4 top-4 z-20">
        <button
          type="button"
          onClick={() => setColorOverlay((v) => !v)}
          className={`text-[10px] uppercase tracking-editorial px-3 py-1.5 rounded-full border ${
            colorOverlay
              ? 'bg-ink-900 text-paper-50 border-ink-900'
              : 'bg-paper-50/90 text-ink-700 border-ink-900/20'
          }`}
        >
          Color Overlay
        </button>
      </div>
      {imageUrl && bounds && overlays.length > 0 ? (
        <div className="h-full w-full p-4">
          <svg className="h-full w-full" viewBox={`0 0 ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMid meet">
            <image href={imageUrl} x="0" y="0" width={bounds.width} height={bounds.height} />
            {overlays.map((space) => {
              const bbox = toBboxArray(space.geometry);
              const [x1, y1, x2, y2] = bbox;
              const active = selectedSpaceId === space.id;
              const fill = space.type === 'exterior' ? '#2f4a62' : '#3d3a34';
              const points =
                space.geometry.type === 'polygon' && Array.isArray(space.geometry.points)
                  ? space.geometry.points.map((pt) => `${pt.x},${pt.y}`).join(' ')
                  : null;
              return (
                <g key={space.id} onClick={() => onSelectSpace?.(space.id)} style={{ cursor: 'pointer' }}>
                  {points ? (
                    <polygon
                      points={points}
                      fill={fill}
                      fillOpacity={colorOverlay ? (active ? 0.3 : 0.18) : 0}
                      stroke={active ? '#d7ab68' : '#e6dac8'}
                      strokeWidth={active ? 3 : 1.5}
                    />
                  ) : (
                    <rect
                      x={x1}
                      y={y1}
                      width={Math.max(1, x2 - x1)}
                      height={Math.max(1, y2 - y1)}
                      fill={fill}
                      fillOpacity={colorOverlay ? (active ? 0.3 : 0.18) : 0}
                      stroke={active ? '#d7ab68' : '#e6dac8'}
                      strokeWidth={active ? 3 : 1.5}
                    />
                  )}
                  <text x={x1 + 8} y={y1 + 18} fill="#fff7ea" fontSize="12" fontWeight="600">
                    {space.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <div className="panel p-5 max-w-md text-center">
            <p className="eyebrow text-ink-500 mb-2">Floorplan Preview Unavailable</p>
            <p className="text-sm text-ink-600 leading-relaxed">
              Floorplan geometry needs confirmation. Return to Review Spaces to finalize the uploaded plan alignment.
            </p>
            {fallback ? (
              <p className="mt-2 text-xs text-ink-500">Open Review Spaces before editing this project floorplan.</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
