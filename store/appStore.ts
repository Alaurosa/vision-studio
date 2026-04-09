import { create } from 'zustand';
import { mockRoomLayout } from '@lib/mock/layout';
import type { ChatMessage, FurnitureItem, RoomLayout } from '@types/index';

interface AppState {
  uploadedImageUrl: string | null;
  selectedFurnitureId: string | null;
  roomLayout: RoomLayout;
  isChatOpen: boolean;
  setUploadedImageUrl: (url: string | null) => void;
  selectFurniture: (id: string) => void;
  toggleChat: () => void;
  resetLayout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  uploadedImageUrl: null,
  selectedFurnitureId: null,
  roomLayout: mockRoomLayout,
  isChatOpen: true,
  setUploadedImageUrl: (url) => set({ uploadedImageUrl: url }),
  selectFurniture: (id) => set({ selectedFurnitureId: id }),
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  resetLayout: () => set({ roomLayout: mockRoomLayout, selectedFurnitureId: null })
}));
