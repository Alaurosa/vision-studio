export default function ProjectSpaceBottomBar({
  spaces = [],
  selectedSpaceId = null,
  onSelectAll,
  onSelectSpace,
  onAddInterior,
  onAddExterior,
}) {
  const interior = (spaces || []).filter((s) => s.type !== 'exterior');
  const exterior = (spaces || []).filter((s) => s.type === 'exterior');

  return (
    <div className="space-y-3 border-t border-ink-900/10 bg-paper-50 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={onSelectAll}
            className={`shrink-0 rounded-full border px-4 py-2 text-[10px] uppercase tracking-editorial ${
              selectedSpaceId == null
                ? 'border-ink-900 bg-ink-900 text-paper-50'
                : 'border-ink-900/15 text-ink-600 hover:border-ink-900'
            }`}
          >
            All Spaces
          </button>
          {interior.map((space) => (
            <button
              type="button"
              key={space.id}
              onClick={() => onSelectSpace?.(space.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-[10px] uppercase tracking-editorial ${
                selectedSpaceId === space.id
                  ? 'border-ink-900 bg-white text-ink-900 shadow-sm'
                  : 'border-ink-900/15 bg-paper-50 text-ink-600 hover:border-ink-900'
              }`}
            >
              {space.name}
            </button>
          ))}
          {exterior.map((space) => (
            <button
              type="button"
              key={space.id}
              onClick={() => onSelectSpace?.(space.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-[10px] uppercase tracking-editorial ${
                selectedSpaceId === space.id
                  ? 'border-ink-900 bg-white text-ink-900 shadow-sm'
                  : 'border-ink-900/15 bg-paper-50 text-ink-600 hover:border-ink-900'
              }`}
            >
              {space.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost text-[10px]" onClick={onAddInterior}>
            + Add Interior
          </button>
          <button type="button" className="btn-ink text-[10px]" onClick={onAddExterior}>
            + Add Exterior
          </button>
        </div>
      </div>
    </div>
  );
}
