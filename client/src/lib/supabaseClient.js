import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const looksValidUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);
const looksLikePlaceholder = (v) => typeof v === 'string' && /^</.test(v);

const url = looksValidUrl(rawUrl) && !looksLikePlaceholder(rawUrl) ? rawUrl : null;
const key = rawKey && !looksLikePlaceholder(rawKey) ? rawKey : null;

/** When false, skip Supabase auth network calls (avoids 403/401 noise against placeholder hosts). */
export const isSupabaseConfigured = Boolean(url && key);

if (import.meta.env.DEV && !isSupabaseConfigured) {
  console.warn(
    '[supabase] Missing Supabase public env vars. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).'
  );
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-anon-key',
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
    },
  }
);
