export interface FurnitureItem {
  id: string;
  name: string;
  category: string;
  provider: string;
  image: string;
  price: string;
  dimensions: string;
}

export interface LayoutItem {
  id: string;
  furnitureId: string;
  label: string;
  position: string;
  notes: string;
}

export interface RoomLayout {
  items: LayoutItem[];
  roomType: string;
  summary: string;
}

export interface ChatMessage {
  id: string;
  sender: 'designer' | 'user' | 'system';
  text: string;
  timestamp: string;
}
