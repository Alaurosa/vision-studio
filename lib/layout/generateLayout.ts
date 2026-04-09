import { mockRoomLayout } from '@lib/mock/layout';
import type { RoomLayout } from '@types/index';

export function generateLayout(roomType: string): Promise<RoomLayout> {
  // TODO: Implement real AI-powered layout generation for the selected room.
  return Promise.resolve({
    ...mockRoomLayout,
    roomType,
    summary: `Generated layout for a ${roomType}.`
  });
}
