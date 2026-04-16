import axios from 'axios';
import { supabase } from './supabaseClient';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

api.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
      return config;
    }
  } catch {
    // Auth not available
  }
  // Fallback: send demo token so server can use demo mode
  if (!config.headers.Authorization) {
    config.headers.Authorization = 'Bearer demo';
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      try { supabase.auth.signOut(); } catch { /* demo mode */ }
    }
    return Promise.reject(err);
  }
);

export default api;
