import { create } from 'zustand';
import api from '@/lib/api';
import { getAABB, overlaps, withinRoom, validateAll } from '@/utils/collision';
import { GRID_SNAP_INCHES } from '@/utils/constants';
import { computeRotation } from '@/utils/scale';

let saveTimers = {};

export const useLayoutStore = create((set, get) => ({
  // ---------- state ----------
  room: null,
  furniture: [],
  selectedId: null,
  detections: [],
  zones: [],
  activeZoneId: null,
  chatHistory: [],
  recommendedItems: [],
  loading: false,
  viewMode: '2d',
  gridEnabled: true,
  isChatOpen: true,
  undoStack: [],
  redoStack: [],
  errors: [],

  // ---------- room ----------
  setRoom: (room) => set({ room }),

  loadRoom: async (roomId) => {
    set({ loading: true });
    try {
      const { data } = await api.get(`/api/rooms/${roomId}`);
      const fallbackZones = data.zones || data.detected_objects?.zones || data.detected_objects?.rooms || [];
      set({
        room: data,
        furniture: data.placements || [],
        detections: data.detected_objects || [],
        zones: fallbackZones,
        loading: false,
      });
    } catch (e) {
      console.error('loadRoom', e);
      set({ loading: false, errors: [...get().errors, 'Failed to load room'] });
    }
  },

  createRoom: async (payload) => {
    const { data } = await api.post('/api/rooms', payload);
    return data;
  },

  updateRoom: async (patch) => {
    const { room } = get();
    if (!room) return;
    set({ room: { ...room, ...patch } });
    await api.put(`/api/rooms/${room.id}`, patch);
  },

  saveRoomGeometry: async (walls, scale) => {
    const { room } = get();
    if (!room) return;
    const { data } = await api.put(`/api/rooms/${room.id}`, {
      walls, scale_px_per_inch: scale,
    });
    set({ room: data });
  },

  // ---------- furniture ----------
  _snapshot: () => {
    const { furniture, undoStack } = get();
    const next = [...undoStack, JSON.parse(JSON.stringify(furniture))].slice(-30);
    set({ undoStack: next, redoStack: [] });
  },

  addFurniture: async (item) => {
    const { room } = get();
    if (!room) return;
    get()._snapshot();
    try {
      const { data } = await api.post('/api/furniture/placements', { ...item, room_id: room.id });
      const placement = {
        ...data,
        image_url: item.image_url || data.image_url || null,
        model_url: item.model_url || data.model_url || null,
      };
      set((s) => ({ furniture: [...s.furniture, placement] }));
      return placement;
    } catch (e) {
      console.error('addFurniture', e);
    }
  },

  updateFurniture: (id, changes) => {
    set((s) => ({
      furniture: s.furniture.map((f) => (f.id === id ? { ...f, ...changes } : f)),
    }));
    // Debounce API save
    clearTimeout(saveTimers[id]);
    saveTimers[id] = setTimeout(async () => {
      try { await api.put(`/api/furniture/placements/${id}`, changes); }
      catch (e) { console.error('update save', e); }
    }, 400);
  },

  removeFurniture: async (id) => {
    get()._snapshot();
    set((s) => ({
      furniture: s.furniture.filter((f) => f.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }));
    try { await api.delete(`/api/furniture/placements/${id}`); }
    catch (e) { console.error('remove', e); }
  },

  selectFurniture: (id) => set({ selectedId: id }),
  clearSelection: () => set({ selectedId: null }),

  rotateFurniture: (id, nextRotation = null) => {
    const { furniture, updateFurniture } = get();
    const item = furniture.find((f) => f.id === id);
    if (!item) return;
    const patch = computeRotation(item, nextRotation);
    updateFurniture(id, patch);
  },

  // ---------- detections ----------
  setDetections: (detections) =>
    set({ detections: (detections || []).map((d) => ({ ...d, status: d.status || 'pending' })) }),
  confirmDetection: (idx) =>
    set((s) => ({
      detections: s.detections.map((d, i) => (i === idx ? { ...d, status: 'confirmed' } : d)),
    })),
  dismissDetection: (idx) =>
    set((s) => ({
      detections: s.detections.map((d, i) => (i === idx ? { ...d, status: 'dismissed' } : d)),
    })),

  // ---------- chat ----------
  addChatMessage: (msg) =>
    set((s) => ({ chatHistory: [...s.chatHistory, { id: Date.now() + Math.random(), ...msg }] })),
  clearChat: () => set({ chatHistory: [] }),

  setRecommendedItems: (items) => set({ recommendedItems: items || [] }),
  clearRecommendedItems: () => set({ recommendedItems: [] }),

  // ---------- ui ----------
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleGrid: () => set((s) => ({ gridEnabled: !s.gridEnabled })),
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),

  undo: () => {
    const { undoStack, furniture } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set((s) => ({
      furniture: prev,
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, furniture].slice(-30),
    }));
  },
  redo: () => {
    const { redoStack, furniture } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set((s) => ({
      furniture: next,
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, furniture].slice(-30),
    }));
  },

  // ---------- zones ----------
  saveZones: (zones) => set({ zones }),
  setActiveZone: (id) => set({ activeZoneId: id }),

  // ---------- helpers ----------
  findOpenSlot: (w, d) => {
    const { room, furniture } = get();
    if (!room?.width || !room?.depth) return { x: 0, y: 0 };
    const step = GRID_SNAP_INCHES;
    for (let y = step; y + d <= room.depth - step; y += step) {
      for (let x = step; x + w <= room.width - step; x += step) {
        const box = { left: x, top: y, right: x + w, bottom: y + d };
        if (!withinRoom(box, room)) continue;
        const clash = furniture.some((f) => overlaps(box, getAABB(f)));
        if (!clash) return { x, y };
      }
    }
    return { x: step, y: step };
  },

  validate: () => {
    const { furniture, room } = get();
    return validateAll(furniture, room);
  },
}));
