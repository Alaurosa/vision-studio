import { useMemo, useState } from 'react';
import FurnitureCatalogPanel from '@/components/catalog/FurnitureCatalogPanel';
import InteriorDesignPanel from '@/components/studio/InteriorDesignPanel';
import { useLayoutStore, selectVisibleFurniture } from '@/store/layoutStore';
import { useRoomExport } from '@/hooks/useRoomExport';

const TABS = [
  { id: 'spaces', label: 'Spaces', icon: '⌂' },
  { id: 'furniture', label: 'Furniture', icon: '▦' },
  { id: 'materials', label: 'Materials', icon: '◫' },
  { id: 'layers', label: 'Layers', icon: '☰' },
  { id: 'export', label: 'Export', icon: '⇩' },
];

/**
 * IDE-style left workspace: tabs + catalog / export / validation / space list.
 */
export default function EditorWorkspaceSidebar({ project, onNavigateToSpace, visionStyleHint = null }) {
  const [tab, setTab] = useState('furniture');
  const furnitureItems = useLayoutStore(selectVisibleFurniture);
  const selectedCatalogItem = useLayoutStore((s) => s.selectedCatalogItem);
  const setSelectedCatalogItem = useLayoutStore((s) => s.setSelectedCatalogItem);
  const clearSelectedCatalogItem = useLayoutStore((s) => s.clearSelectedCatalogItem);
  const { runExport, exporting, roomReady } = useRoomExport();

  const spacesInterior = useMemo(
    () => (project?.spaces || []).filter((s) => s.type === 'interior'),
    [project?.spaces],
  );
  const spacesExterior = useMemo(
    () => (project?.spaces || []).filter((s) => s.type === 'exterior'),
    [project?.spaces],
  );

  const activeTab = TABS.find((t) => t.id === tab) || null;
  const panelOpen = Boolean(activeTab);
  const switchTab = (nextTabId) => {
    setTab((prev) => (prev === nextTabId ? null : nextTabId));
  };

  return (
    <div className="flex h-full min-h-0 bg-[#f8f8f6]">
      <div className="flex w-14 shrink-0 flex-col items-center border-r border-[rgba(0,0,0,0.08)] bg-[#f4efe7] py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            title={t.label}
            aria-label={t.label}
            className={`mb-1 inline-flex h-10 w-10 items-center justify-center rounded-lg border text-sm transition ${
              tab === t.id
                ? 'border-[#004aad]/40 bg-[#eef4f7] text-[#004aad]'
                : 'border-transparent text-[#6a645b] hover:border-[rgba(0,0,0,0.08)] hover:bg-[#fffdf9]'
            }`}
          >
            <span className="leading-none">{t.icon}</span>
          </button>
        ))}
      </div>

      {panelOpen && (
        <div className="flex w-[260px] min-h-0 shrink-0 flex-col overflow-hidden border-r border-[rgba(0,0,0,0.08)]">
          <div className="shrink-0 border-b border-[rgba(0,0,0,0.08)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b]">{activeTab?.label}</p>
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

            {tab === 'furniture' && (
              <div className="flex min-h-0 flex-1 flex-col">
                {selectedCatalogItem && (
                  <div className="shrink-0 border-b border-[rgba(0,0,0,0.08)] bg-[#eef4f7] px-4 py-2.5">
                    <p className="text-[11px] leading-relaxed text-[#004aad]">
                      <span className="font-medium text-[#171717]">Selected:</span>{' '}
                      {selectedCatalogItem.name}. Click the canvas to place.
                    </p>
                    <button
                      type="button"
                      onClick={clearSelectedCatalogItem}
                      className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-[#5b5b5b] underline hover:text-[#171717]"
                    >
                      Clear selection
                    </button>
                  </div>
                )}
                <FurnitureCatalogPanel
                  selectedItemId={selectedCatalogItem?.id ?? null}
                  onSelectItem={setSelectedCatalogItem}
                  defaultStyleHint={visionStyleHint}
                />
              </div>
            )}

            {tab === 'materials' && <InteriorDesignPanel />}

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
      )}
    </div>
  );
}
