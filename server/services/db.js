/**
 * Shared database availability check.
 * Eliminates the `useDb()` boilerplate duplicated across every route file.
 */
import { supabaseAdmin, hasSupabaseCredentials } from './supabase.js';
import * as fallback from './fallbackStore.js';

export async function useDb() {
  // Skip the (slow) network probe entirely when credentials are obviously
  // missing or placeholder — go straight to the in-memory fallback path.
  if (!hasSupabaseCredentials) return false;
  return fallback.checkDbAvailable(supabaseAdmin);
}

export { supabaseAdmin, fallback };
