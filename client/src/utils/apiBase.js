/** Dev uses Vite proxy (/api → :3001); production uses env or localhost default. */
export function getApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) return '';
  return 'http://localhost:3001';
}
