import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const looksValidUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);
// Reject `<placeholder>` envelopes plus the well-known .env.example fillers
// (`https://your-project.supabase.co`, `your-service-role-key`, etc.) so the
// server boots in fallback mode instead of trying to hit unreachable hosts.
const looksLikePlaceholder = (v) =>
  typeof v === 'string' &&
  (/^</.test(v) ||
    /(^|\/)your[-_]?project(\.|$)/i.test(v) ||
    /^your[-_]?(service|anon|public|api)/i.test(v));

const url = looksValidUrl(rawUrl) && !looksLikePlaceholder(rawUrl) ? rawUrl : null;
const key = rawKey && !looksLikePlaceholder(rawKey) ? rawKey : null;

/** True when both URL and service-role key look real (no placeholders, no missing values). */
export const hasSupabaseCredentials = Boolean(url && key);

if (!hasSupabaseCredentials) {
  console.warn(
    'WARNING: Missing or placeholder SUPABASE URL / SUPABASE_SERVICE_ROLE_KEY. URL can come from SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL; server still requires a real SUPABASE_SERVICE_ROLE_KEY. Running in in-memory fallback mode.'
  );
}

// We still always export a client — downstream code expects `.from()` to exist — but
// when credentials are missing the client points at a harmless placeholder URL.
// Any database call will fail gracefully at request time instead of crashing boot.
export const supabaseAdmin = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-service-role-key'
);
