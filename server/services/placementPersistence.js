import { supabaseAdmin } from './db.js';

/** Optional placement columns that may be missing on older Supabase deployments. */
const OPTIONAL_PLACEMENT_COLUMNS = ['zone_id', 'image_url', 'model_url'];

/**
 * PostgREST/schema-cache error when a column is not on the remote placements table.
 * @param {{ message?: string } | null | undefined} error
 * @param {string} column
 */
export function isMissingPlacementColumnError(error, column) {
  const msg = error?.message || '';
  return new RegExp(column, 'i').test(msg) && /(schema cache|column)/i.test(msg);
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{ data: object | null, error: { message?: string } | null }>}
 */
export async function insertPlacementRow(payload) {
  const row = { ...payload };
  let data = null;
  let error = null;

  for (let attempt = 0; attempt <= OPTIONAL_PLACEMENT_COLUMNS.length; attempt++) {
    ({ data, error } = await supabaseAdmin.from('placements').insert(row).select().single());
    if (!error) return { data, error: null };

    const missing = OPTIONAL_PLACEMENT_COLUMNS.find(
      (col) => col in row && isMissingPlacementColumnError(error, col),
    );
    if (!missing) break;
    delete row[missing];
  }

  return { data, error };
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} updates
 * @returns {Promise<{ data: object | null, error: { message?: string } | null }>}
 */
export async function updatePlacementRow(id, updates) {
  const row = { ...updates };
  let data = null;
  let error = null;

  for (let attempt = 0; attempt <= OPTIONAL_PLACEMENT_COLUMNS.length; attempt++) {
    ({ data, error } = await supabaseAdmin
      .from('placements')
      .update(row)
      .eq('id', id)
      .select()
      .single());
    if (!error) return { data, error: null };

    const missing = OPTIONAL_PLACEMENT_COLUMNS.find(
      (col) => col in row && isMissingPlacementColumnError(error, col),
    );
    if (!missing) break;
    delete row[missing];
  }

  return { data, error };
}
