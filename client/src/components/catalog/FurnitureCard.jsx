import { useState } from 'react';
import clsx from 'clsx';
import { getFurnitureCategoryLabel } from '@/data/furnitureCatalog';
import {
  formatFurnitureDimensions,
  formatModelStatusLabel,
  formatProviderLabel,
} from '@/utils/furnitureDisplay';

/**
 * @param {{
 *   item: import('@/data/furnitureCatalog.js').FurnitureCatalogItem,
 *   isSelected?: boolean,
 *   onSelect?: (item: import('@/data/furnitureCatalog.js').FurnitureCatalogItem) => void,
 * }} props
 */
export default function FurnitureCard({ item, isSelected = false, onSelect }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(item.previewImageUrl) && !imageFailed;
  const categoryLabel = getFurnitureCategoryLabel(item.category);
  const dimensionsLabel = formatFurnitureDimensions(item.dimensions);
  const providerLabel = formatProviderLabel(item.provider);
  const modelStatusLabel = formatModelStatusLabel(item.modelStatus);

  const className = clsx(
    'w-full text-left border transition group',
    'border-surface-600 bg-surface-700 hover:border-surface-500',
    isSelected && 'ring-2 ring-blue-600 border-blue-600',
    onSelect &&
      'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
  );

  const preview = (
    <div className="aspect-[4/3] overflow-hidden border-b border-surface-600 bg-surface-600">
      {showImage ? (
        <img
          src={item.previewImageUrl}
          alt=""
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-surface-400">
            Preview coming soon
          </span>
          {modelStatusLabel && (
            <span className="text-[10px] text-surface-500">{modelStatusLabel}</span>
          )}
        </div>
      )}
    </div>
  );

  const body = (
    <>
      {preview}
      {isSelected && (
        <div className="bg-blue-600 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-white">
          Click in the room to place
        </div>
      )}
      <div className="p-4">
        <div className="mb-1 truncate text-sm font-medium text-surface-100">{item.name}</div>
        <div className="mb-2 text-[11px] uppercase tracking-editorial text-surface-400">
          {categoryLabel}
        </div>
        <div className="mb-3 font-mono text-xs text-surface-300">{dimensionsLabel}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-surface-500">
          {providerLabel && <span>{providerLabel}</span>}
          {providerLabel && modelStatusLabel && <span aria-hidden="true">·</span>}
          {modelStatusLabel && <span className="normal-case tracking-normal">{modelStatusLabel}</span>}
        </div>
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => onSelect(item)}
        aria-label={`Select ${item.name}`}
        aria-pressed={isSelected}
      >
        {body}
      </button>
    );
  }

  return (
    <article className={className} aria-label={item.name}>
      {body}
    </article>
  );
}
