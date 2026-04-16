import { create } from 'zustand';
import api from '../lib/api';
import { toast } from '../components/ui/Toast';

// Debounce API calls for furniture updates during drag
const updateTimers = {};
function debouncedApiPut(id, changes, delay = 300) {
  if (updateTimers[id]) clearTimeout(updateTimers[id]);
  updateTimers[id] = setTimeout(async () => {
    try {
      await api.put(`/api/furniture/placements/${id}`, changes);
    } catch (err) {
      console.error('Failed to save placement:', err);
      toast.error('Could not save change — check your connection.');
    }
    delete updateTimers[id];
  }, delay);
}

export const useLayoutStore = create((set, get) => ({
  // Room state
  room: null,
  furniture: [],
  selectedId: null,
  detections: [],

  // Zones (sub-rooms within a plan). activeZoneId=null = whole-plan view.
  zones: [],
  activeZoneId: null,
  chatHistory: [],
  recommendedItems: [],
  loading: false,
  errors: [],

  // Undo/redo history
  undoStack: [],
  redoStack: [],

  // View state
  viewMode: '2d', // '2d' | '3d'
  gridEnabled: true,
  isChatOpen: true,

  // Push current furniture state to undo stack
  _pushUndo: () => {
    const { furniture, undoStack } = get();
    const snapshot = furniture.map(f => ({ ...f }));
    set({ undoStack: [...undoStack.slice(-30), snapshot], redoStack: [] });
  },

  undo: () => {
    const { undoStack, furniture } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, state.furniture.map(f => ({ ...f }))],
      furniture: prev,
      selectedId: null,
    }));
    // Sync with backend - update positions for each item
    for (const item of prev) {
      debouncedApiPut(item.id, { x_inches: item.x_inches, y_inches: item.y_inches, rotation: item.rotation });
    }
  },

  redo: () => {
    const { redoStack, furniture } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, state.furniture.map(f => ({ ...f }))],
      furniture: next,
      selectedId: null,
    }));
    for (const item of next) {
      debouncedApiPut(item.id, { x_inches: item.x_inches, y_inches: item.y_inches, rotation: item.rotation });
    }
  },

  // Room actions
  setRoom: (room) => set({ room }),

  loadRoom: async (roomId) => {
    set({ loading: true });
    try {
      const { data } = await api.get(`/api/rooms/${roomId}`);
      const zones = data.zones || data.detected_objects?.zones || [];
      set({
        room: data,
        furniture: data.placements || [],
        zones,
        activeZoneId: null,
        loading: false,
        detections: [],
      });
    } catch (err) {
      set({ loading: false, errors: [err.message] });
      throw err;
    }
  },

  createRoom: async (name) => {
    const { data } = await api.post('/api/rooms', { name: name || 'My Room' });
    return data;
  },

  saveRoomGeometry: async (walls, scale) => {
    const { room } = get();
    if (!room) return;
    const { data } = await api.put(`/api/rooms/${room.id}`, {
      walls,
      scale_px_per_inch: scale,
    });
    set({ room: data });
  },

  updateRoom: async (changes) => {
    const { room } = get();
    if (!room) return;
    try {
      const { data } = await api.put(`/api/rooms/${room.id}`, changes);
      set({ room: data });
    } catch (err) {
      console.error('Failed to update room:', err);
      toast.error('Could not save room changes.');
    }
  },

  // Furniture actions
  addFurniture: async (item) => {
    const { room, activeZoneId } = get();
    if (!room) return;
    const { data } = await api.post('/api/furniture/placements', {
      ...item,
      room_id: room.id,
      zone_id: item.zone_id ?? activeZoneId ?? null,
    });
    set((state) => ({ furniture: [...state.furniture, data] }));
    return data;
  },

  updateFurniture: async (id, changes) => {
    get()._pushUndo();
    set((state) => ({
      furniture: state.furniture.map((f) => (f.id === id ? { ...f, ...changes } : f)),
    }));
    debouncedApiPut(id, changes);
  },

  removeFurniture: async (id) => {
    get()._pushUndo();
    set((state) => ({ furniture: state.furniture.filter((f) => f.id !== id) }));
    try {
      await api.delete(`/api/furniture/placements/${id}`);
    } catch (err) {
      console.error('Failed to delete placement:', err);
      toast.error('Could not delete furniture on the server.');
    }
  },

  selectFurniture: (id) => set({ selectedId: id }),
  clearSelection: () => set({ selectedId: null }),

  // Detection actions
  setDetections: (detections) =>
    set({
      detections: detections.map((d) => ({ ...d, status: 'pending' })),
    }),

  confirmDetection: (i) =>
    set((state) => ({
      detections: state.detections.map((d, idx) => (idx === i ? { ...d, status: 'confirmed' } : d)),
    })),

  dismissDetection: (i) =>
    set((state) => ({
      detections: state.detections.map((d, idx) => (idx === i ? { ...d, status: 'dismissed' } : d)),
    })),

  // Chat actions
  addChatMessage: (msg) =>
    set((state) => ({
      chatHistory: [...state.chatHistory, msg],
    })),

  clearChat: () => set({ chatHistory: [] }),

  // Recommendation actions
  setRecommendedItems: (items) => set({ recommendedItems: items }),
  clearRecommendedItems: () => set({ recommendedItems: [] }),

  // Zone actions
  setActiveZone: (zoneId) => set({ activeZoneId: zoneId, selectedId: null }),

  saveZones: async (zones) => {
    const { room } = get();
    if (!room) return;
    set({ zones });
    try {
      const { data } = await api.put(`/api/rooms/${room.id}`, { zones });
      const nextZones = data.zones || data.detected_objects?.zones || zones;
      set({ room: data, zones: nextZones });
    } catch (err) {
      console.error('Failed to save zones:', err);
      toast.error('Could not save rooms.');
    }
  },

  addZone: (zone) => {
    const zones = [...get().zones, zone];
    get().saveZones(zones);
  },

  updateZone: (zoneId, patch) => {
    const zones = get().zones.map((z) => (z.id === zoneId ? { ...z, ...patch } : z));
    get().saveZones(zones);
  },

  removeZone: (zoneId) => {
    const zones = get().zones.filter((z) => z.id !== zoneId);
    const { activeZoneId } = get();
    if (activeZoneId === zoneId) set({ activeZoneId: null });
    get().saveZones(zones);
  },

  // Returns furniture visible in current view (whole plan or active zone)
  getVisibleFurniture: () => {
    const { furniture, activeZoneId } = get();
    if (!activeZoneId) return furniture;
    return furniture.filter((f) => f.zone_id === activeZoneId);
  },

  // View actions
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleGrid: () => set((state) => ({ gridEnabled: !state.gridEnabled })),
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
}));
