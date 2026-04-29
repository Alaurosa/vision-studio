import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey =
  process.env.SUPABASE_PUBLIC_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Treat placeholder values (the <paste-...> scaffolding) as "not configured"
// so we can still boot the server and let public/guest endpoints work.
const looksValidUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);
const looksLikePlaceholder = (v) => typeof v === 'string' && /^</.test(v);

const supabaseUrl = looksValidUrl(rawUrl) && !looksLikePlaceholder(rawUrl) ? rawUrl : null;
const supabaseKey = rawKey && !looksLikePlaceholder(rawKey) ? rawKey : null;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[auth] Missing Supabase auth env vars in root .env (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_PUBLIC_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) — auth is disabled; guest/public endpoints still work, protected endpoints will 401.'
  );
}

const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  const token = authHeader.split(' ')[1];

  // Fallback test account
  if (token === TEST_TOKEN) {
    req.user = TEST_USER;
    return next();
  }

  if (!supabase) {
    return res.status(401).json({ error: 'Supabase is not configured on the server.' });
  }

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

/**
 * Like requireAuth but allows unauthenticated requests through with a guest user.
 * Sets req.user to a guest stub if no valid token is provided.
 */
const TEST_TOKEN = 'vs-test-token-001';
const TEST_USER = { id: 'test-user-001', email: 'test@visionstudio.dev' };

export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    // Fallback test account
    if (token === TEST_TOKEN) {
      req.user = TEST_USER;
      return next();
    }

    // Supabase auth
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data.user) {
          req.user = data.user;
          return next();
        }
      } catch { /* fall through to guest */ }
    }
  }
  // Guest fallback
  req.user = { id: 'guest', email: 'guest' };
  next();
}
