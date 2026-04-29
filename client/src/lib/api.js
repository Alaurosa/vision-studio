import axios from 'axios';
import { supabase } from './supabaseClient';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

// Attach auth token to every outgoing request
api.interceptors.request.use(async (config) => {
  // Check for fallback test session first
  const testToken = localStorage.getItem('vs_test_session');
  if (testToken) {
    config.headers.Authorization = `Bearer ${testToken}`;
    return config;
  }
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    // Supabase not configured — skip auth header
  }
  return config;
});

export default api;
