import { mockChatMessages } from '@lib/mock/chat';
import type { ChatMessage } from '@types/index';

export function chatWithDesigner(prompt: string): Promise<ChatMessage[]> {
  // TODO: Implement real chat flow with AI and persistence.
  return Promise.resolve([
    ...mockChatMessages,
    {
      id: `chat-${Date.now()}`,
      sender: 'designer',
      text: `This is a placeholder response for: ${prompt}`,
      timestamp: 'Just now'
    }
  ]);
}
