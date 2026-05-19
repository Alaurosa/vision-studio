import { useMemo, useState } from 'react';
import clsx from 'clsx';
import FurnitureCard from '@/components/catalog/FurnitureCard';
import {
  FURNITURE_CATEGORIES,
  STARTER_FURNITURE_CATALOG,
} from '@/data/furnitureCatalog';
import { filterStarterFurnitureCatalog } from '@/utils/furnitureCatalogFilters';

/**
 * @param {{
 *   onSelectItem?: (item: import('@/data/furnitureCatalog.js').FurnitureCatalogItem) => void,
 * }} props
 */
export default function FurnitureCatalogPanel({ onSelectItem }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(null);

  const filteredItems = useMemo(
    () =>
      filterStarterFurnitureCatalog(STARTER_FURNITURE_CATALOG, {
        searchQuery,
        categoryId,
      }),
    [searchQuery, categoryId],
  );

  const handleSelect = (item) => {
    setSelectedItemId(item.id);
    onSelectItem?.(item);
  };

  const resultLabel =
    filteredItems.length === 1 ? '1 piece' : `${filteredItems.length} pieces`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3 border-b border-[rgba(0,0,0,0.08)] px-4 py-4">
        <div>
          <h2 className="font-display text-base text-[#171717]">Furniture</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#5b5b5b]">
            Browse starter pieces for your space.
          </p>
        </div>

        <div>
          <label htmlFor="furniture-catalog-search" className="sr-only">
            Search furniture
          </label>
          <input
            id="furniture-catalog-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, category, provider…"
            aria-label="Search furniture"
            className="w-full rounded-lg border border-[rgba(0,0,0,0.12)] bg-[#fffdf9] px-3 py-2 text-sm text-[#171717] placeholder:text-[#8a8a8a] focus:border-[#004aad]/45 focus:outline-none focus:ring-2 focus:ring-[#004aad]/20"
          />
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          <CategoryChip
            label="All"
            active={categoryId === ''}
            onClick={() => setCategoryId('')}
          />
          {FURNITURE_CATEGORIES.map((category) => (
            <CategoryChip
              key={category.id}
              label={category.label}
              active={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
            />
          ))}
        </div>

        <p className="text-[10px] uppercase tracking-[0.14em] text-[#5b5b5b]" aria-live="polite">
          {resultLabel}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {filteredItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.12)] bg-[#fffdf9] px-4 py-10 text-center">
            <p className="text-sm font-medium text-[#171717]">No furniture matches</p>
            <p className="mt-1 text-xs text-[#5b5b5b]">
              Try another search term or category filter.
            </p>
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Furniture catalog results">
            {filteredItems.map((item) => (
              <li key={item.id}>
                <FurnitureCard
                  item={item}
                  isSelected={selectedItemId === item.id}
                  onSelect={handleSelect}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CategoryChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] transition',
        active
          ? 'border-[#004aad] bg-[#eef4f7] text-[#004aad]'
          : 'border-[rgba(0,0,0,0.12)] bg-[#fffdf9] text-[#5b5b5b] hover:border-[#004aad]/35',
      )}
    >
      {label}
    </button>
  );
}
