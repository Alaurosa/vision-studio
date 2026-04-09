import type { RoomLayout } from '@types/index';

export const mockRoomLayout: RoomLayout = {
  roomType: 'Living room',
  summary: 'Mock room layout with future furniture placement points.',
  items: [
    {
      id: 'layout-item-01',
      furnitureId: 'ikea-sofa-01',
      label: 'Sofa zone',
      position: 'center',
      notes: 'Placeholder for sofa placement in the room canvas.'
    },
    {
      id: 'layout-item-02',
      furnitureId: 'ikea-table-01',
      label: 'Coffee table',
      position: 'front',
      notes: 'Placeholder for table placement in the room canvas.'
    }
  ]
};
