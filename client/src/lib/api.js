import axios from 'axios';
import { supabase } from './supabaseClient';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// We intentionally DO NOT force a redirect on 401 anymore.
// The app supports a guest/draft mode where many calls will legitimately 401,
// and the store should handle those silently instead of bouncing the user.
api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
);

export async function isAuthed() {
  const { data } = await supabase.auth.getSession();
  return !!data.session?.access_token;
}

export default api;
