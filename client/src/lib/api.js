import axios from 'axios';
import { supabase } from './supabaseClient';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeout: 120000,
});

// Attach Supabase JWT when available; fall back to 'demo' so server demo-mode works.
api.interceptors.request.use(async (config) => {
  let token = 'demo';
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) token = data.session.access_token;
    } catch { /* ignore, use demo */ }
  }
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    return Promise.reject(err);
  }
);

export default api;
