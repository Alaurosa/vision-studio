import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.SUPABASE_URL;
const rawKey = process.env.SUPABASE_ANON_KEY;

// Treat placeholder values (the <paste-...> scaffolding) as "not configured"
// so we can still boot the server and let public/guest endpoints work.
const looksValidUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);
const looksLikePlaceholder = (v) => typeof v === 'string' && /^</.test(v);

const supabaseUrl = looksValidUrl(rawUrl) && !looksLikePlaceholder(rawUrl) ? rawUrl : null;
const supabaseKey = rawKey && !looksLikePlaceholder(rawKey) ? rawKey : null;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[auth] SUPABASE_URL / SUPABASE_ANON_KEY missing or placeholder — auth is disabled; guest/public endpoints still work, all protected endpoints will 401.'
  );
}

const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function requireAuth(req, res, next) {
  if (!supabase) {
    return res.status(401).json({ error: 'Supabase is not configured on the server.' });
  }
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  const token = authHeader.split(' ')[1];

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = data.user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Auth verification failed' });
  }
}
