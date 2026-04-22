import { useMemo } from 'react';
import { useLayoutStore } from '@/store/layoutStore';
import { inchesToFeet } from '@/utils/scale';

export default function ZoneBottomBar() {
  const {
    zones,
    activeZoneId,
    setActiveZone,
    addZone,
    updateZone,
    removeZone,
  } = useLayoutStore();

  const activeZone = useMemo(
    () => (activeZoneId ? zones.find((zone) => zone.id === activeZoneId) || null : null),
    [zones, activeZoneId]
  );

  return (
    <div className="border-t border-ink-900/10 bg-paper-50 px-5 py-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveZone(null)}
            className={`shrink-0 rounded-full border px-4 py-2 text-[10px] uppercase tracking-editorial transition ${
              activeZoneId == null
                ? 'border-ink-900 bg-ink-900 text-paper-50'
                : 'border-ink-900/15 text-ink-600 hover:border-ink-900'
            }`}
          >
            All Rooms
          </button>
          {zones.map((zone) => (
            <button
              key={zone.id}
              onClick={() => setActiveZone(zone.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-left transition ${
                activeZoneId === zone.id
                  ? 'border-ink-900 bg-white text-ink-900 shadow-sm'
                  : 'border-ink-900/15 bg-paper-50 text-ink-600 hover:border-ink-900'
              }`}
            >
              <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: zone.color }} />
              <span className="text-[10px] uppercase tracking-editorial">{zone.name}</span>
            </button>
          ))}
        </div>

        <button className="btn-ink shrink-0" onClick={() => addZone()}>
          + Add Room
        </button>
      </div>

      {activeZone && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(180px,2fr)_repeat(4,minmax(90px,1fr))_auto] items-end">
          <label>
            <div className="eyebrow mb-2 text-ink-500">Room label</div>
            <input
              className="input-field"
              value={activeZone.name}
              onChange={(e) => updateZone(activeZone.id, { name: e.target.value })}
            />
          </label>
          <label>
            <div className="eyebrow mb-2 text-ink-500">X</div>
            <input
              type="number"
              className="input-field"
              value={Math.round(activeZone.bbox[0])}
              onChange={(e) => {
                const left = Number(e.target.value) || 0;
                updateZone(activeZone.id, {
                  bbox: [left, activeZone.bbox[1], left + activeZone.width, activeZone.bbox[3]],
                });
              }}
            />
          </label>
          <label>
            <div className="eyebrow mb-2 text-ink-500">Y</div>
            <input
              type="number"
              className="input-field"
              value={Math.round(activeZone.bbox[1])}
              onChange={(e) => {
                const top = Number(e.target.value) || 0;
                updateZone(activeZone.id, {
                  bbox: [activeZone.bbox[0], top, activeZone.bbox[2], top + activeZone.depth],
                });
              }}
            />
          </label>
          <label>
            <div className="eyebrow mb-2 text-ink-500">Width</div>
            <input
              type="number"
              className="input-field"
              value={Math.round(activeZone.width)}
              onChange={(e) => {
                const width = Math.max(24, Number(e.target.value) || 24);
                updateZone(activeZone.id, {
                  width,
                  bbox: [activeZone.bbox[0], activeZone.bbox[1], activeZone.bbox[0] + width, activeZone.bbox[3]],
                });
              }}
            />
          </label>
          <label>
            <div className="eyebrow mb-2 text-ink-500">Depth</div>
            <input
              type="number"
              className="input-field"
              value={Math.round(activeZone.depth)}
              onChange={(e) => {
                const depth = Math.max(24, Number(e.target.value) || 24);
                updateZone(activeZone.id, {
                  depth,
                  bbox: [activeZone.bbox[0], activeZone.bbox[1], activeZone.bbox[2], activeZone.bbox[1] + depth],
                });
              }}
            />
          </label>
          <div className="flex items-center gap-2 justify-end">
            <div className="rounded-full border border-ink-900/10 px-3 py-2 text-[10px] uppercase tracking-editorial text-ink-500">
              {inchesToFeet(activeZone.width)} × {inchesToFeet(activeZone.depth)}
            </div>
            <button
              className="rounded-full border border-red-300 px-4 py-2 text-[10px] uppercase tracking-editorial text-red-600 transition hover:bg-red-600 hover:text-white"
              onClick={() => removeZone(activeZone.id)}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}