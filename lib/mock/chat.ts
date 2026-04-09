import type { ChatMessage } from '@types/index';

export const mockChatMessages: ChatMessage[] = [
  {
    id: 'chat-01',
    sender: 'system',
    text: 'Welcome to the Vision Studios placeholder assistant.',
    timestamp: 'Now'
  },
  {
    id: 'chat-02',
    sender: 'designer',
    text: 'This section will help you shape the room with conversational design guidance.',
    timestamp: '2 min ago'
  }
];
