import axios from 'axios';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getApiBaseUrl } from '@/utils/apiBase';

const api = axios.create({
  baseURL: getApiBaseUrl(),
});

// Attach auth token to every outgoing request
api.interceptors.request.use(async (config) => {
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return config;
      }
    } catch {
      // Supabase session unavailable — fall through to test token
    }
  }
  const testToken = localStorage.getItem('vs_test_session');
  if (testToken) {
    config.headers.Authorization = `Bearer ${testToken}`;
  }
  return config;
});

export default api;
