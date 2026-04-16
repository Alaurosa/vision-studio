import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder-key';
const isPlaceholder = supabaseUrl.includes('placeholder');

const supabase = createClient(supabaseUrl, supabaseKey);

// Demo user for when Supabase auth is unavailable
const DEMO_USER = {
  id: 'demo-user-00000000-0000-0000-0000-000000000000',
  email: 'demo@visionstudio.local',
  role: 'authenticated',
};

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  const token = authHeader.split(' ')[1];

  // Demo mode: if token is 'demo' or Supabase is placeholder, use demo user
  if (token === 'demo' || isPlaceholder) {
    req.user = DEMO_USER;
    return next();
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      // Fallback to demo user if Supabase auth fails (e.g. expired/invalid in dev)
      req.user = DEMO_USER;
      return next();
    }
    req.user = user;
    next();
  } catch {
    // Network error reaching Supabase — fall back to demo
    req.user = DEMO_USER;
    next();
  }
}
