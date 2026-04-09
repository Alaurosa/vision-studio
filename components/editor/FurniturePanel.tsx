'use client';

import { mockFurnitureCatalog } from '@lib/mock/furniture';
import { useAppStore } from '@store/appStore';

export function FurniturePanel() {
  const selectedFurnitureId = useAppStore((state) => state.selectedFurnitureId);
  const selectFurniture = useAppStore((state) => state.selectFurniture);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Furniture panel</h2>
          <p className="text-sm text-slate-400">Choose an item to add to the future layout.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {mockFurnitureCatalog.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectFurniture(item.id)}
            className={`flex flex-col items-start gap-3 rounded-3xl border p-4 text-left transition ${
              selectedFurnitureId === item.id
                ? 'border-brand-500 bg-slate-900/80'
                : 'border-white/10 bg-slate-950/80 hover:border-slate-500'
            }`}
          >
            <div className="flex h-28 w-full items-center justify-center rounded-3xl bg-slate-900 text-slate-400">
              <span>{item.image}</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{item.name}</h3>
              <p className="text-xs text-slate-400">{item.category}</p>
              <p className="mt-1 text-xs text-slate-500">{item.provider}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
