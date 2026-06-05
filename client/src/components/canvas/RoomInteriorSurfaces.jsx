import { Rect } from 'react-konva';
import { normalizeRoomInterior } from '@/data/roomInterior';

/**
 * Full-floor interior fill for 2D canvas (no wall bands on the four sides).
 */
export default function RoomInteriorSurfaces({
  interior,
  originX,
  originY,
  widthPx,
  heightPx,
}) {
  if (!(widthPx > 0 && heightPx > 0)) return null;

  const config = normalizeRoomInterior(interior);

  return (
    <Rect
      x={originX}
      y={originY}
      width={widthPx}
      height={heightPx}
      fill={config.floorColor}
      listening={false}
    />
  );
}
