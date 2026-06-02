import { useMemo, useState } from 'react';
import clsx from 'clsx';
import FurnitureCard from '@/components/catalog/FurnitureCard';
import {
  FURNITURE_CATEGORIES,
  STARTER_FURNITURE_CATALOG,
} from '@/data/furnitureCatalog';
import { filterStarterFurnitureCatalog } from '@/utils/furnitureCatalogFilters';
import { recommendForRoom } from '@/utils/recommendationRules';
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
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const [internalSelectedItemId, setInternalSelectedItemId] = useState(null);
  const selectedItemId = selectedItemIdProp ?? internalSelectedItemId;

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

  const roomRecommendations = useMemo(() => {
    if (!roomKnown) return null;
    return recommendForRoom({
      room,
      placements: furniture,
      catalog: STARTER_FURNITURE_CATALOG,
      category: categoryId,
    });
  }, [roomKnown, categoryId, room, furniture]);

  const recommendedEntries = roomRecommendations?.items ?? [];

  const handleSelect = (item) => {
    if (selectedItemIdProp == null) {
      setInternalSelectedItemId(item.id);
    }
    onSelectItem?.(item);
  };

  const browseLabel =
    browseResults.length === 1 ? '1 piece' : `${browseResults.length} pieces`;

  const roomLabel = roomKnown
    ? `${inchesToFeet(room.width)} × ${inchesToFeet(room.depth)} room`
    : 'Room dimensions unknown';

  const recommendationSummary = !roomKnown
    ? 'Set room size to unlock picks'
    : recommendedEntries.length === 0
      ? 'No fits for current filters'
      : `${recommendedEntries.length} pick${recommendedEntries.length === 1 ? '' : 's'} for this room`;

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

        <p className="text-[10px] uppercase tracking-[0.14em] text-[#5b5b5b]">{roomLabel}</p>

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
          {browseLabel}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
        <RecommendedCollapsible
          open={recommendationsOpen}
          onToggle={() => setRecommendationsOpen((prev) => !prev)}
          summary={recommendationSummary}
          roomKnown={roomKnown}
          roomRecommendations={roomRecommendations}
          categoryId={categoryId}
          recommendedEntries={recommendedEntries}
          selectedItemId={selectedItemId}
          onSelect={handleSelect}
        />

        <section aria-label="Furniture catalog">
          {browseResults.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.12)] bg-[#fffdf9] px-4 py-10 text-center">
              <p className="text-sm font-medium text-[#171717]">No furniture matches</p>
              <p className="mt-1 text-xs text-[#5b5b5b]">
                Try another search term or category filter.
              </p>
            </div>
          ) : (
            <ul className="space-y-3" aria-label="Furniture catalog results">
              {browseResults.map((item) => (
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
        </section>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   open: boolean,
 *   onToggle: () => void,
 *   summary: string,
 *   roomKnown: boolean,
 *   roomRecommendations: ReturnType<typeof recommendForRoom> | null,
 *   categoryId: string,
 *   recommendedEntries: Array<{ item: import('@/data/furnitureCatalog.js').FurnitureCatalogItem, reasons?: string[] | null }>,
 *   selectedItemId: string | null,
 *   onSelect: (item: import('@/data/furnitureCatalog.js').FurnitureCatalogItem) => void,
 * }} props
 */
function RecommendedCollapsible({
  open,
  onToggle,
  summary,
  roomKnown,
  roomRecommendations,
  categoryId,
  recommendedEntries,
  selectedItemId,
  onSelect,
}) {
  const triggerId = 'furniture-recommended-trigger';
  const panelId = 'furniture-recommended-panel';

  return (
    <section aria-labelledby={triggerId} data-testid="recommended-collapsible">
      <button
        id={triggerId}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        data-testid="recommended-collapsible-trigger"
        className={clsx(
          'group w-full rounded-lg border text-left transition',
          open
            ? 'border-[#004aad]/35 bg-[#eef4f7] shadow-sm'
            : 'border-[#004aad]/20 bg-[#eef4f7]/70 hover:border-[#004aad]/35 hover:bg-[#eef4f7]',
        )}
      >
        <div className="flex items-start gap-3 px-3.5 py-3">
          <span
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#004aad]/25 bg-[#fffdf9] text-sm text-[#004aad]"
            aria-hidden="true"
          >
            ✦
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="font-display text-sm text-[#171717]">
                Recommended for this room
              </span>
              <span
                className={clsx(
                  'shrink-0 text-[#004aad] transition-transform duration-200',
                  open && 'rotate-180',
                )}
                aria-hidden="true"
              >
                ▾
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-[#5b5b5b]">{summary}</span>
          </span>
        </div>
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className="mt-2 space-y-2 rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#fffdf9] p-3"
          data-testid="recommended-collapsible-panel"
        >
          {roomKnown && roomRecommendations?.metrics && (
            <p
              className="text-[10px] uppercase tracking-[0.14em] text-[#5b5b5b]"
              data-testid="recommendation-metrics"
            >
              {roomRecommendations.roomBucket} room · open area{' '}
              {inchesToFeet(roomRecommendations.metrics.largestFreeRect.width)} ×{' '}
              {inchesToFeet(roomRecommendations.metrics.largestFreeRect.depth)}
              {categoryId
                ? ` · ${FURNITURE_CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId}`
                : ''}
            </p>
          )}

          {!roomKnown ? (
            <RecommendedEmptyState
              title="Set room dimensions to see recommendations"
              detail="Recommendations rank items by fit, available space, and what's already in the room."
            />
          ) : recommendedEntries.length === 0 ? (
            <RecommendedEmptyState
              title="No pieces fit this room right now"
              detail={
                categoryId
                  ? 'Try another category, clear some furniture, or browse the catalog below.'
                  : 'Clear some furniture or browse the catalog below for more options.'
              }
            />
          ) : (
            <ul className="space-y-3" aria-label="Recommended furniture for this room">
              {recommendedEntries.map(({ item, reasons }) => (
                <li key={`rec-${item.id}`}>
                  <FurnitureCard
                    item={item}
                    isSelected={selectedItemId === item.id}
                    onSelect={onSelect}
                  />
                  {reasons && reasons.length > 0 && (
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
      )}
    </section>
  );
}

function RecommendedEmptyState({ title, detail }) {
  return (
    <div
      className="rounded-lg border border-dashed border-[rgba(0,0,0,0.12)] bg-[#fffdf9] px-4 py-6 text-center"
      data-testid="recommended-empty-state"
    >
      <p className="text-sm font-medium text-[#171717]">{title}</p>
      <p className="mt-1 text-xs text-[#5b5b5b]">{detail}</p>
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
