import { useMemo, useState } from 'react';
import clsx from 'clsx';
import FurnitureCard from '@/components/catalog/FurnitureCard';
import {
  FURNITURE_CATEGORIES,
  STARTER_FURNITURE_CATALOG,
} from '@/data/furnitureCatalog';
import { filterStarterFurnitureCatalog } from '@/utils/furnitureCatalogFilters';
import { recommendFurniture } from '@/utils/recommendationRules';
import { useLayoutStore } from '@/store/layoutStore';
import { inchesToFeet } from '@/utils/scale';

/**
 * @param {{
 *   onSelectItem?: (item: import('@/data/furnitureCatalog.js').FurnitureCatalogItem) => void,
 *   selectedItemId?: string | null,
 * }} props
 */
export default function FurnitureCatalogPanel({ onSelectItem, selectedItemId: selectedItemIdProp }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [mode, setMode] = useState('browse');
  const [internalSelectedItemId, setInternalSelectedItemId] = useState(null);
  const selectedItemId = selectedItemIdProp ?? internalSelectedItemId;

  // Live room state for the Recommended mode. Subscribed narrowly so the panel
  // only re-renders when these slices change.
  const room = useLayoutStore((s) => s.room);
  const furniture = useLayoutStore((s) => s.furniture);

  const roomKnown = Boolean(room?.width && room?.depth);

  const browseResults = useMemo(
    () =>
      filterStarterFurnitureCatalog(STARTER_FURNITURE_CATALOG, {
        searchQuery,
        categoryId,
      }),
    [searchQuery, categoryId],
  );

  const recommendation = useMemo(() => {
    if (mode !== 'recommended' || !categoryId) return null;
    return recommendFurniture({
      room,
      placements: furniture,
      catalog: STARTER_FURNITURE_CATALOG,
      category: categoryId,
    });
  }, [mode, categoryId, room, furniture]);

  // Recommendation entries are objects with { item, score, reasons, rotationHint }.
  // Browse results are raw catalog items. Normalize to a single shape for rendering.
  const renderEntries = useMemo(() => {
    if (mode === 'recommended' && recommendation) {
      return recommendation.items.map((entry) => ({
        item: entry.item,
        reasons: entry.reasons,
        rotationHint: entry.rotationHint,
      }));
    }
    return browseResults.map((item) => ({ item, reasons: null, rotationHint: 0 }));
  }, [mode, recommendation, browseResults]);

  const handleSelect = (item) => {
    if (selectedItemIdProp == null) {
      setInternalSelectedItemId(item.id);
    }
    onSelectItem?.(item);
  };

  const handleSetCategory = (nextCategoryId) => {
    setCategoryId(nextCategoryId);
  };

  const handleToggleMode = () => {
    setMode((prev) => (prev === 'recommended' ? 'browse' : 'recommended'));
  };

  const resultLabel =
    renderEntries.length === 1 ? '1 piece' : `${renderEntries.length} pieces`;

  const roomLabel = roomKnown
    ? `${inchesToFeet(room.width)} × ${inchesToFeet(room.depth)} room`
    : 'Room dimensions unknown';

  const showRecommendedHint =
    mode === 'recommended' && (!roomKnown || !categoryId);

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
            disabled={mode === 'recommended'}
            className="w-full rounded-lg border border-[rgba(0,0,0,0.12)] bg-[#fffdf9] px-3 py-2 text-sm text-[#171717] placeholder:text-[#8a8a8a] focus:border-[#004aad]/45 focus:outline-none focus:ring-2 focus:ring-[#004aad]/20 disabled:opacity-50"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-[#5b5b5b]">
            {roomLabel}
          </span>
          <button
            type="button"
            onClick={handleToggleMode}
            disabled={!roomKnown}
            aria-pressed={mode === 'recommended'}
            title={
              roomKnown
                ? 'Filter to items that fit this room based on size, available space, and category'
                : 'Set room dimensions to enable recommendations'
            }
            className={clsx(
              'rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-50',
              mode === 'recommended'
                ? 'border-[#004aad] bg-[#004aad] text-white'
                : 'border-[rgba(0,0,0,0.12)] bg-[#fffdf9] text-[#171717] hover:border-[#004aad]/45',
            )}
          >
            {mode === 'recommended' ? 'Recommended on' : 'Recommended'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          <CategoryChip
            label="All"
            active={categoryId === ''}
            onClick={() => handleSetCategory('')}
            disabled={mode === 'recommended'}
          />
          {FURNITURE_CATEGORIES.map((category) => (
            <CategoryChip
              key={category.id}
              label={category.label}
              active={categoryId === category.id}
              onClick={() => handleSetCategory(category.id)}
            />
          ))}
        </div>

        {mode === 'recommended' && recommendation?.metrics && (
          <p
            className="text-[10px] uppercase tracking-[0.14em] text-[#5b5b5b]"
            data-testid="recommendation-metrics"
          >
            {recommendation.roomBucket} room · open area{' '}
            {inchesToFeet(recommendation.metrics.largestFreeRect.width)} ×{' '}
            {inchesToFeet(recommendation.metrics.largestFreeRect.depth)}
          </p>
        )}

        <p className="text-[10px] uppercase tracking-[0.14em] text-[#5b5b5b]" aria-live="polite">
          {resultLabel}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {showRecommendedHint ? (
          <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.12)] bg-[#fffdf9] px-4 py-10 text-center">
            <p className="text-sm font-medium text-[#171717]">
              {roomKnown ? 'Pick a category to see recommendations' : 'Set room dimensions to enable recommendations'}
            </p>
            <p className="mt-1 text-xs text-[#5b5b5b]">
              Recommendations rank items by fit, available space, and category rules.
            </p>
          </div>
        ) : renderEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.12)] bg-[#fffdf9] px-4 py-10 text-center">
            <p className="text-sm font-medium text-[#171717]">
              {mode === 'recommended' ? 'No items fit this category right now' : 'No furniture matches'}
            </p>
            <p className="mt-1 text-xs text-[#5b5b5b]">
              {mode === 'recommended'
                ? 'Try a different category, clear some furniture, or use Browse mode.'
                : 'Try another search term or category filter.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Furniture catalog results">
            {renderEntries.map(({ item, reasons }) => (
              <li key={item.id}>
                <FurnitureCard
                  item={item}
                  isSelected={selectedItemId === item.id}
                  onSelect={handleSelect}
                />
                {mode === 'recommended' && reasons && reasons.length > 0 && (
                  <p
                    className="mt-1 px-1 text-[11px] leading-snug text-[#5b5b5b]"
                    data-testid={`recommendation-reason-${item.id}`}
                  >
                    {reasons[0]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CategoryChip({ label, active, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={clsx(
        'rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] transition',
        active
          ? 'border-[#004aad] bg-[#eef4f7] text-[#004aad]'
          : 'border-[rgba(0,0,0,0.12)] bg-[#fffdf9] text-[#5b5b5b] hover:border-[#004aad]/35',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {label}
    </button>
  );
}
