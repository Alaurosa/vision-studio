import { Line } from 'react-konva';
import { GRID_SNAP_INCHES } from '@/utils/constants';

export default function GridOverlay({ originX, originY, width, height, pxPerInch }) {
  const step = GRID_SNAP_INCHES * pxPerInch;
  const lines = [];
  for (let x = 0; x <= width; x += step) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[originX + x, originY, originX + x, originY + height]}
        stroke="rgba(16,15,13,0.06)"
        strokeWidth={1}
      />
    );
  }
  for (let y = 0; y <= height; y += step) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[originX, originY + y, originX + width, originY + y]}
        stroke="rgba(16,15,13,0.06)"
        strokeWidth={1}
      />
    );
  }
  return <>{lines}</>;
}
