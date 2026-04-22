import axios from 'axios';
import { supabase } from './supabaseClient';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

// Cached session token to avoid calling getSession() on every request
let cachedToken = null;
let tokenExpiry = 0;

api.interceptors.request.use(async (config) => {
  const now = Date.now();

  // Refresh cached token if expired or missing (cache for 50 minutes)
  if (!cachedToken || now > tokenExpiry) {
    try {
      const { data } = await supabase.auth.getSession();
      cachedToken = data.session?.access_token || 'demo';
      // Cache for 50 min (tokens typically last 60 min)
      tokenExpiry = now + 50 * 60 * 1000;
    } catch {
      cachedToken = 'demo';
      tokenExpiry = now + 5 * 60 * 1000; // Retry sooner on error
    }
  }

  config.headers.Authorization = `Bearer ${cachedToken}`;
  return config;
});

// Clear token cache on 401 so next request gets a fresh one
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      cachedToken = null;
      tokenExpiry = 0;
      await supabase.auth.signOut();
    }
    return Promise.reject(err);
  }
);

export default api;
