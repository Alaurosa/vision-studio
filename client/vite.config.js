import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load VITE_* vars from root .env, then client/.env.local
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '..'), '');

  return {
  plugins: [react()],
  define: {
    // Map root env vars to VITE_ equivalents so Supabase config works
    // Only expose what the client needs — never expose secret keys
    ...(rootEnv.SUPABASE_URL && !process.env.VITE_SUPABASE_URL
      ? { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(rootEnv.SUPABASE_URL) }
      : {}),
    ...(rootEnv.SUPABASE_ANON_KEY && !process.env.VITE_SUPABASE_ANON_KEY
      ? { 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(rootEnv.SUPABASE_ANON_KEY) }
      : {}),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  };
});
