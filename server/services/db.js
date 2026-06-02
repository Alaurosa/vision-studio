/**
 * Shared database availability check.
 * Eliminates the `useDb()` boilerplate duplicated across every route file.
 */
import { supabaseAdmin, hasSupabaseCredentials } from './supabase.js';
import * as fallback from './fallbackStore.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when user id is a Supabase auth UUID (not guest/test fallback ids). */
export const hasDbUserId = (userId) => typeof userId === 'string' && UUID_RE.test(userId);

export async function useDb() {
  // Skip the (slow) network probe entirely when credentials are obviously
  // missing or placeholder — go straight to the in-memory fallback path.
  if (!hasSupabaseCredentials) return false;
  return fallback.checkDbAvailable(supabaseAdmin);
}

/** Resolve a room from the in-memory store (guest/test tolerant). */
export function getFallbackRoom(roomId, userId) {
  if (!roomId) return null;
  return (
    fallback.getRoom(roomId, userId) ||
    (userId !== 'guest' ? fallback.getRoom(roomId, 'guest') : null) ||
    (userId !== 'test-user-001' ? fallback.getRoom(roomId, 'test-user-001') : null)
  );
}

/** Verify the caller owns the room before mutating placements or room rows. */
export async function roomOwnedByUser(roomId, userId) {
  if (!roomId) return false;
  if ((await useDb()) && hasDbUserId(userId)) {
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .eq('user_id', userId)
      .single();
    return Boolean(data && !error);
  }
  return Boolean(getFallbackRoom(roomId, userId));
}

export { supabaseAdmin, fallback };
