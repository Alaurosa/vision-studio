import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import CatalogPanel from '@/components/catalog/CatalogPanel';
import { useLayoutStore } from '@/store/layoutStore';
import { useRoomExport } from '@/hooks/useRoomExport';

const TABS = [
  { id: 'spaces', label: 'Spaces' },
  { id: 'furniture', label: 'Furniture' },
  { id: 'materials', label: 'Materials' },
  { id: 'layers', label: 'Layers' },
  { id: 'views', label: 'Views' },
  { id: 'export', label: 'Export' },
];

/**
 * IDE-style left workspace: tabs + catalog / export / validation / space list.
 */
export default function EditorWorkspaceSidebar({ project, onNavigateToSpace }) {
  const [tab, setTab] = useState('furniture');
  const furnitureItems = useLayoutStore((s) => s.furniture);
  const validate = useLayoutStore((s) => s.validate);
  const { runExport, exporting, roomReady } = useRoomExport();

  const spacesInterior = useMemo(
    () => (project?.spaces || []).filter((s) => s.type === 'interior'),
    [project?.spaces],
  );
  const spacesExterior = useMemo(
    () => (project?.spaces || []).filter((s) => s.type === 'exterior'),
    [project?.spaces],
  );

  const runValidatePanel = () => {
    const { valid, errors } = validate();
    if (valid) toast.success('Layout looks clean — no overlaps or overflow.');
    else toast.error(errors.slice(0, 5).join(' · '));
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f8f8f6]">
      <div className="shrink-0 border-b border-[rgba(0,0,0,0.08)] px-2 py-2 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`text-[9px] uppercase tracking-[0.14em] px-2 py-1.5 rounded-md border transition whitespace-nowrap ${
                tab === t.id
                  ? 'border-[#004aad]/45 bg-[#eef4f7] text-[#004aad]'
                  : 'border-transparent text-[#5b5b5b] hover:border-[rgba(0,0,0,0.08)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {tab === 'spaces' && (
          <div className="p-4 space-y-4 text-sm">
            <button
              type="button"
              disabled={!onNavigateToSpace}
              onClick={() => onNavigateToSpace?.(null)}
              className="w-full text-left rounded-lg border border-[rgba(0,0,0,0.06)] bg-[#eef4f7] px-3 py-2 text-xs hover:border-[#004aad]/35 disabled:opacity-40"
            >
              All Spaces
            </button>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b]">Interior spaces</p>
            {!project?.spaces?.length ? (
              <p className="text-xs text-[#5b5b5b]">No linked spaces in this project yet.</p>
            ) : (
              <ul className="space-y-1">
                {spacesInterior.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={!onNavigateToSpace}
                      onClick={() => onNavigateToSpace?.(s.id)}
                      className="w-full text-left rounded-lg border border-[rgba(0,0,0,0.06)] bg-[#fffdf9] px-3 py-2 text-xs hover:border-[#004aad]/35 disabled:opacity-40"
                    >
                      ⌂ {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] pt-2">Exterior areas</p>
            <ul className="space-y-1">
              {spacesExterior.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!onNavigateToSpace}
                    onClick={() => onNavigateToSpace?.(s.id)}
                    className="w-full text-left rounded-lg border border-[rgba(0,0,0,0.06)] bg-[#fffdf9] px-3 py-2 text-xs hover:border-[#004aad]/35 disabled:opacity-40"
                  >
                    ◌ {s.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'furniture' && <CatalogPanel />}

        {tab === 'materials' && (
          <div className="p-5 text-sm text-[#5b5b5b] leading-relaxed">
            <p className="font-display text-base text-[#171717] mb-2">Materials</p>
            <p className="text-xs">
              Material palettes and finishes for this space will appear here in a future update.
            </p>
          </div>
        )}

        {tab === 'layers' && (
          <div className="p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] mb-3">Objects in room</p>
            {furnitureItems.length === 0 ? (
              <p className="text-xs text-[#5b5b5b]">No furniture placed yet.</p>
            ) : (
              <ul className="space-y-2">
                {furnitureItems.map((f) => (
                  <li key={f.id} className="text-xs border border-[rgba(0,0,0,0.06)] rounded-lg px-3 py-2 bg-[#fffdf9]">
                    <span className="font-medium text-[#171717]">{f.name}</span>
                    <span className="block text-[10px] text-[#8a8a8a] mt-0.5">{f.category}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'views' && (
          <div className="p-4 space-y-4">
            <p className="text-xs text-[#5b5b5b] leading-relaxed">
              Switch between full-floorplan and focused space views from the bottom bar; run validation for the active space.
            </p>
            <button type="button" className="btn-ink w-full text-[10px] py-2" onClick={runValidatePanel}>
              Validate active layout
            </button>
          </div>
        )}

        {tab === 'export' && (
          <div className="p-4 space-y-4">
            <p className="text-xs text-[#5b5b5b] leading-relaxed">
              Download layout data for this room. Uses the same export pipeline as before.
            </p>
            <div className="flex flex-col gap-2">
              {['json', 'svg', 'dxf'].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  disabled={!roomReady || exporting}
                  onClick={() => runExport(fmt)}
                  className="text-[10px] uppercase tracking-editorial px-4 py-2.5 rounded-lg border border-[rgba(0,0,0,0.12)] bg-[#fffdf9] hover:border-[#004aad]/35 disabled:opacity-40"
                >
                  Export {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
