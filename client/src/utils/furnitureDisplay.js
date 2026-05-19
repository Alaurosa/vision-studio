/**
 * Display helpers for furniture catalog UI.
 */

/**
 * @param {{ width: number, depth: number, height: number } | null | undefined} dimensions
 * @returns {string}
 */
export function formatFurnitureDimensions(dimensions) {
  if (!dimensions) return '';
  const { width, depth, height } = dimensions;
  return `${width}" W × ${depth}" D × ${height}" H`;
}

/**
 * @param {string | null | undefined} provider
 * @returns {string}
 */
export function formatProviderLabel(provider) {
  if (!provider) return '';
  return provider
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * @param {'placeholder' | 'curated' | 'generated' | 'missing' | string | null | undefined} status
 * @returns {string}
 */
export function formatModelStatusLabel(status) {
  if (!status) return '';
  const labels = {
    placeholder: 'Placeholder model',
    curated: 'Curated model',
    generated: 'Generated model',
    missing: 'Model unavailable',
  };
  return labels[status] ?? status;
}
