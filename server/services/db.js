/**
 * Shared database availability check.
 * Eliminates the `useDb()` boilerplate duplicated across every route file.
 */
import { supabaseAdmin } from './supabase.js';
import * as fallback from './fallbackStore.js';

export async function useDb() {
  return fallback.checkDbAvailable(supabaseAdmin);
}

export { supabaseAdmin, fallback };
