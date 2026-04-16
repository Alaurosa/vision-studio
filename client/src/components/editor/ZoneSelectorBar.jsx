import { useLayoutStore } from '../../store/layoutStore';

// Default palette for zones that have no color set
const ZONE_PALETTE = [
  '#f59e0b', '#10b981', '#3b82f6', '#ec4899',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316',
];

export function zoneColor(zone, index = 0) {
  return zone?.color || ZONE_PALETTE[index % ZONE_PALETTE.length];
}

export default function ZoneSelectorBar() {
  const zones = useLayoutStore((s) => s.zones);
  const activeZoneId = useLayoutStore((s) => s.activeZoneId);
  const furniture = useLayoutStore((s) => s.furniture);
  const setActiveZone = useLayoutStore((s) => s.setActiveZone);
  const removeZone = useLayoutStore((s) => s.removeZone);

  if (!zones || zones.length === 0) return null;

  const countFor = (id) => furniture.filter((f) => f.zone_id === id).length;

  return (
    <div className="bg-slate-900/70 border-t border-white/10 px-3 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
      <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mr-1 shrink-0">
        Rooms
      </span>

      {/* Whole plan pill */}
      <button
        onClick={() => setActiveZone(null)}
        className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition border ${
          activeZoneId === null
            ? 'bg-slate-800 text-white border-slate-800'
            : 'bg-slate-900/70 text-slate-300 border-white/10 hover:bg-slate-800'
        }`}
        title="View entire floor plan"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12 12 2.25 21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
        </svg>
        Whole plan
        <span className="text-[10px] opacity-70">({furniture.length})</span>
      </button>

      <div className="w-px h-6 bg-slate-700 shrink-0" />

      {zones.map((zone, i) => {
        const active = activeZoneId === zone.id;
        const color = zoneColor(zone, i);
        return (
          <div key={zone.id} className="relative group shrink-0">
            <button
              onClick={() => setActiveZone(zone.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                active
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-slate-900/70 text-slate-200 border-white/10 hover:bg-slate-800'
              }`}
              style={active ? { backgroundColor: color } : {}}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color, boxShadow: active ? '0 0 0 2px rgba(255,255,255,0.5)' : 'none' }}
              />
              <span className="max-w-[120px] truncate">{zone.name || `Room ${i + 1}`}</span>
              <span className={`text-[10px] ${active ? 'opacity-80' : 'opacity-60'}`}>
                ({countFor(zone.id)})
              </span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Remove "${zone.name || `Room ${i + 1}`}" from this plan? Placed furniture will remain but become unassigned.`)) {
                  removeZone(zone.id);
                }
              }}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-900/70 border border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-300 text-[10px] leading-none opacity-0 group-hover:opacity-100 transition"
              title="Remove room"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
