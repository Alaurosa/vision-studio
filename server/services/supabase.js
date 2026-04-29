import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const looksValidUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);
const looksLikePlaceholder = (v) => typeof v === 'string' && /^</.test(v);

const url = looksValidUrl(rawUrl) && !looksLikePlaceholder(rawUrl) ? rawUrl : null;
const key = rawKey && !looksLikePlaceholder(rawKey) ? rawKey : null;

if (!url || !key) {
  console.warn(
    'WARNING: Missing SUPABASE URL or SUPABASE_SERVICE_ROLE_KEY. URL can come from SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, but server still requires SUPABASE_SERVICE_ROLE_KEY for DB/admin operations.'
  );
}

// We still always export a client — downstream code expects `.from()` to exist — but
// when credentials are missing the client points at a harmless placeholder URL.
// Any database call will fail gracefully at request time instead of crashing boot.
export const supabaseAdmin = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-service-role-key'
);
