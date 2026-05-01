import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '@/lib/api';
import { getAABB, overlaps, withinRoom, validateAll } from '@/utils/collision';
import { GRID_SNAP_INCHES, getZoneColor } from '@/utils/constants';
import { computeRotation } from '@/utils/scale';

const snapToGrid = (value, gridSize) => Math.round(value / gridSize) * gridSize;

const DRAFT_PREFIX = 'draft-';
const isDraftId = (id) => typeof id === 'string' && id.startsWith(DRAFT_PREFIX);
const newDraftId = () => `${DRAFT_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const newPlacementId = () => `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let saveTimers = {};
let zoneSaveTimer = null;

function normalizeZone(zone, index = 0) {
  const bbox = Array.isArray(zone?.bbox) && zone.bbox.length === 4
    ? zone.bbox.map((value) => Number(value) || 0)
    : [0, 0, zone?.width || 120, zone?.depth || 120];
  const width = zone?.width ?? Math.max(0, bbox[2] - bbox[0]);
  const depth = zone?.depth ?? Math.max(0, bbox[3] - bbox[1]);
  const polygon = Array.isArray(zone?.polygon) && zone.polygon.length >= 3
    ? zone.polygon
    : [[bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[2], bbox[3]], [bbox[0], bbox[3]]];

  return {
    id: zone?.id || `zone-${index}`,
    name: zone?.name || zone?.label || `Room ${index + 1}`,
    bbox,
    polygon,
    width,
    depth,
    color: zone?.color || getZoneColor(index),
    confidence: zone?.confidence ?? null,
  };
}

function normalizeZonesArray(zones) {
  return (Array.isArray(zones) ? zones : []).map((zone, index) => normalizeZone(zone, index));
}

function getZoneBounds(zone) {
  if (!zone) return null;
  const bbox = Array.isArray(zone.bbox) && zone.bbox.length === 4 ? zone.bbox : null;
  if (bbox) return { left: bbox[0], top: bbox[1], right: bbox[2], bottom: bbox[3] };
  return null;
}

function getFurnitureCenter(item) {
  const box = getAABB(item);
  return {
    x: (box.left + box.right) / 2,
    y: (box.top + box.bottom) / 2,
  };
}

function furnitureBelongsToZone(item, zone) {
  const bounds = getZoneBounds(zone);
  if (!bounds) return true;
  const center = getFurnitureCenter(item);
  return center.x >= bounds.left && center.x <= bounds.right && center.y >= bounds.top && center.y <= bounds.bottom;
}

function normalizeDetectedObjects(detectedObjects) {
  if (Array.isArray(detectedObjects)) return detectedObjects;
  if (Array.isArray(detectedObjects?.detections)) return detectedObjects.detections;
  if (Array.isArray(detectedObjects?.objects)) return detectedObjects.objects;
  return [];
}

function normalizeZoneObjects(data) {
  if (Array.isArray(data?.zones)) return normalizeZonesArray(data.zones);
  if (Array.isArray(data?.detected_objects?.zones)) return normalizeZonesArray(data.detected_objects.zones);
  if (Array.isArray(data?.detected_objects?.rooms)) return normalizeZonesArray(data.detected_objects.rooms);
  return normalizeZonesArray([]);
}

export const useLayoutStore = create(
  persist(
    (set, get) => ({
      // ---------- state ----------
      room: null,
      furniture: [],
      selectedId: null,
      detections: [],
      zones: [],
      activeZoneId: null,
      chatHistory: [],
      projectTheme: null,
      recommendedItems: [],
      loading: false,
      viewMode: '2d',
      gridEnabled: true,
      isChatOpen: true,
      undoStack: [],
      redoStack: [],

      // ---------- room ----------
      loadRoom: async (roomId) => {
        // Draft rooms are purely client-side — just set them from persisted state
        if (isDraftId(roomId)) {
          const { room } = get();
          if (room?.id === roomId) {
            // Already loaded from persist
            set({ loading: false });
          }
          return;
        }
        set({ loading: true });
        try {
          const { data } = await api.get(`/api/rooms/${roomId}`);
          const fallbackZones = normalizeZoneObjects(data);
          set({
            room: data,
            furniture: data.placements || [],
            detections: normalizeDetectedObjects(data.detected_objects),
            zones: fallbackZones,
            activeZoneId: fallbackZones[0]?.id || null,
            loading: false,
          });
        } catch (e) {
          console.error('loadRoom', e);
          set({ loading: false });
        }
      },

      createRoom: async (payload) => {
        const { data } = await api.post('/api/rooms', payload);
        return data;
      },

      // Create a local draft room (guest mode — no server call)
      createDraftRoom: (payload) => {
        const id = newDraftId();
        const room = {
          id,
          name: payload.name || 'Draft Room',
          unit: payload.unit || 'inches',
          width: payload.width || null,
          depth: payload.depth || null,
          height: payload.height || null,
          scale_px_per_inch: payload.scale_px_per_inch || null,
          walls: payload.walls || null,
        };
        const zones = normalizeZonesArray(payload.zones || []);
        set({
          room,
          furniture: [],
          zones,
          activeZoneId: zones[0]?.id || null,
          detections: [],
          chatHistory: [],
          projectTheme: null,
          undoStack: [],
          redoStack: [],
        });
        return room;
      },

      clearDraft: () => {
        set({
          room: null,
          furniture: [],
          zones: [],
          activeZoneId: null,
          detections: [],
          chatHistory: [],
          projectTheme: null,
          undoStack: [],
          redoStack: [],
        });
      },

      updateRoom: async (patch) => {
        const { room } = get();
        if (!room) return;
        set({ room: { ...room, ...patch } });
        if (!isDraftId(room.id)) {
          await api.put(`/api/rooms/${room.id}`, patch);
        }
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

        // Draft mode — add locally with a generated ID
        if (isDraftId(room.id)) {
          const placement = {
            id: newPlacementId(),
            room_id: room.id,
            ...item,
          };
          set((s) => ({ furniture: [...s.furniture, placement] }));
          return placement;
        }

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
        const { room } = get();
        set((s) => ({
          furniture: s.furniture.map((f) => (f.id === id ? { ...f, ...changes } : f)),
        }));
        // Skip server save for draft rooms
        if (room && isDraftId(room.id)) return;
        // Debounce API save
        clearTimeout(saveTimers[id]);
        saveTimers[id] = setTimeout(async () => {
          try { await api.put(`/api/furniture/placements/${id}`, changes); }
          catch (e) { console.error('update save', e); }
        }, 400);
      },

      removeFurniture: async (id) => {
        const { room } = get();
        get()._snapshot();
        set((s) => ({
          furniture: s.furniture.filter((f) => f.id !== id),
          selectedId: s.selectedId === id ? null : s.selectedId,
        }));
        if (room && isDraftId(room.id)) return;
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
      setProjectTheme: (theme) => set({ projectTheme: theme || null }),

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
      _persistZones: () => {
        clearTimeout(zoneSaveTimer);
        const { room } = get();
        if (!room?.id || isDraftId(room.id)) return;
        zoneSaveTimer = setTimeout(async () => {
          const { room: r, zones } = get();
          if (!r?.id || isDraftId(r.id)) return;
          try {
            await api.put(`/api/rooms/${r.id}`, { zones });
          } catch (e) {
            console.error('save zones', e);
          }
        }, 250);
      },

      saveZones: (zones) => {
        const normalized = normalizeZonesArray(zones);
        set({ zones: normalized, activeZoneId: normalized[0]?.id || null });
        get()._persistZones();
      },

      addZone: (zonePatch = {}) => {
        const { room, zones } = get();
        const offset = 24 + zones.length * 12;
        const width = Math.min(144, Math.max(72, (room?.width || 240) - offset * 2));
        const depth = Math.min(144, Math.max(72, (room?.depth || 180) - offset * 2));
        const nextZone = normalizeZone({
          id: `zone-${Date.now()}`,
          name: zonePatch.name || `Room ${zones.length + 1}`,
          bbox: zonePatch.bbox || [offset, offset, offset + width, offset + depth],
          width,
          depth,
          ...zonePatch,
        }, zones.length);
        set((state) => ({ zones: [...state.zones, nextZone], activeZoneId: nextZone.id }));
        get()._persistZones();
      },

      updateZone: (id, patch) => {
        set((state) => ({
          zones: state.zones.map((zone, index) => {
            if (zone.id !== id) return zone;
            const bbox = patch.bbox || zone.bbox;
            const width = patch.width ?? Math.max(0, bbox[2] - bbox[0]);
            const depth = patch.depth ?? Math.max(0, bbox[3] - bbox[1]);
            const polygon = patch.polygon || [[bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[2], bbox[3]], [bbox[0], bbox[3]]];
            return normalizeZone({ ...zone, ...patch, bbox, polygon, width, depth }, index);
          }),
        }));
        get()._persistZones();
      },

      removeZone: (id) => {
        set((state) => {
          const nextZones = state.zones.filter((zone) => zone.id !== id);
          return {
            zones: nextZones,
            activeZoneId: state.activeZoneId === id ? nextZones[0]?.id || null : state.activeZoneId,
          };
        });
        get()._persistZones();
      },

      setActiveZone: (id) => set({ activeZoneId: id }),

      getActiveZone: () => {
        const { zones, activeZoneId } = get();
        return zones.find((zone) => zone.id === activeZoneId) || null;
      },

      getVisibleFurniture: () => {
        const { furniture } = get();
        const activeZone = get().getActiveZone();
        if (!activeZone) return furniture;
        return furniture.filter((item) => furnitureBelongsToZone(item, activeZone));
      },

      // ---------- draft → account migration ----------
      // Pushes the current draft room to the server. Assumes caller verified auth.
      saveDraftToAccount: async () => {
        const { room, zones, furniture } = get();
        if (!room || !isDraftId(room.id)) {
          throw new Error('Nothing to save — no draft is active.');
        }

        // 1. Create the room on the server.
        const createRes = await api.post('/api/rooms', {
          name: room.name || 'My Room',
          unit: room.unit || 'inches',
          width: room.width || null,
          depth: room.depth || null,
          height: room.height || null,
        });
        const serverRoom = createRes.data;

        // 2. Save zones + geometry onto the room.
        if ((zones && zones.length) || room.scale_px_per_inch) {
          try {
            await api.put(`/api/rooms/${serverRoom.id}`, {
              zones: zones || [],
              scale_px_per_inch: room.scale_px_per_inch || null,
              walls: room.walls || null,
            });
          } catch (e) {
            console.warn('Saved room but zone/geometry save failed:', e.message);
          }
        }

        // 3. Recreate each placement on the server. Keep their order.
        const savedPlacements = [];
        for (const f of furniture) {
          try {
            const { id: _drop, room_id: _drop2, created_at: _drop3, ...payload } = f;
            const { data } = await api.post('/api/furniture/placements', {
              ...payload,
              room_id: serverRoom.id,
            });
            savedPlacements.push({
              ...data,
              image_url: f.image_url || data.image_url || null,
              model_url: f.model_url || data.model_url || null,
            });
          } catch (e) {
            console.warn('Failed to save a placement:', e.message);
          }
        }

        // 4. Pull the fresh room back so we have the server's canonical version.
        try {
          const { data } = await api.get(`/api/rooms/${serverRoom.id}`);
          const fallbackZones = normalizeZoneObjects(data);
          set({
            room: data,
            furniture: data.placements || savedPlacements,
            zones: fallbackZones.length ? fallbackZones : zones,
            activeZoneId: (fallbackZones[0] || zones[0])?.id || null,
          });
        } catch (e) {
          set({
            room: serverRoom,
            furniture: savedPlacements,
          });
        }

        return serverRoom;
      },

      // ---------- helpers ----------
      findOpenSlot: (w, d) => {
        const { room, furniture } = get();
        const activeZone = get().getActiveZone();
        if (!room?.width || !room?.depth) return { x: 0, y: 0 };
        const step = GRID_SNAP_INCHES;
        const bounds = getZoneBounds(activeZone) || { left: 0, top: 0, right: room.width, bottom: room.depth };
        const minX = Math.max(step, snapToGrid(bounds.left, step));
        const minY = Math.max(step, snapToGrid(bounds.top, step));
        const maxX = Math.min(room.width - step, bounds.right);
        const maxY = Math.min(room.depth - step, bounds.bottom);
        for (let y = minY; y + d <= maxY; y += step) {
          for (let x = minX; x + w <= maxX; x += step) {
            const box = { left: x, top: y, right: x + w, bottom: y + d };
            if (!withinRoom(box, room)) continue;
            if (activeZone && (box.left < bounds.left || box.top < bounds.top || box.right > bounds.right || box.bottom > bounds.bottom)) continue;
            const clash = furniture.some((f) => overlaps(box, getAABB(f)));
            if (!clash) return { x, y };
          }
        }
        return { x: minX, y: minY };
      },

      validate: () => {
        const { furniture, room } = get();
        return validateAll(furniture, room);
      },
    }),
    {
      name: 'vs-draft-v1',
      storage: createJSONStorage(() => localStorage),
      // Only persist draft data. If the room is a server room, there's no need
      // to snapshot it — we'll always re-fetch on load.
      partialize: (state) => {
        if (!isDraftId(state.room?.id)) {
          return {
            viewMode: state.viewMode,
            gridEnabled: state.gridEnabled,
            isChatOpen: state.isChatOpen,
            projectTheme: state.projectTheme,
          };
        }
        return {
          room: state.room,
          furniture: state.furniture,
          zones: state.zones,
          activeZoneId: state.activeZoneId,
          projectTheme: state.projectTheme,
          viewMode: state.viewMode,
          gridEnabled: state.gridEnabled,
          isChatOpen: state.isChatOpen,
        };
      },
    }
  )
);
