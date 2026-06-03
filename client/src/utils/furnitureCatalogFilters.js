import { getFurnitureCategoryLabel } from '@/data/furnitureCatalog';
import { itemHasStyleTag } from '@/data/furnitureStyleTags';
import { formatProviderLabel } from '@/utils/furnitureDisplay';

/**
 * @param {import('@/data/furnitureCatalog.js').FurnitureCatalogItem[]} items
 * @param {{ searchQuery?: string, categoryId?: string, styleTagId?: string }} options
 * @returns {import('@/data/furnitureCatalog.js').FurnitureCatalogItem[]}
 */
export function filterStarterFurnitureCatalog(
  items,
  { searchQuery = '', categoryId = '', styleTagId = '' } = {},
) {
  const query = searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    if (categoryId && item.category !== categoryId) return false;
    if (styleTagId && !itemHasStyleTag(item, styleTagId)) return false;
    if (!query) return true;

    const categoryLabel = getFurnitureCategoryLabel(item.category).toLowerCase();
    const providerLabel = formatProviderLabel(item.provider).toLowerCase();
    const tagText = (item.tags || []).join(' ').toLowerCase();
    const haystack = [
      item.name,
      item.category,
      categoryLabel,
      item.provider,
      providerLabel,
      tagText,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
}
