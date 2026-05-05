import api from './api';

/** Dedupe concurrent GET /api/rooms (e.g. React StrictMode double-mount + multiple pages). */
let inflight = null;

export async function fetchRoomsListOnce() {
  if (!inflight) {
    inflight = api.get('/api/rooms').finally(() => {
      inflight = null;
    });
  }
  const { data } = await inflight;
  return Array.isArray(data) ? data : [];
}
