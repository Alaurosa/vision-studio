import { Line, Group } from 'react-konva';
import { GRID_SNAP_INCHES } from '../../utils/constants';

export default function GridOverlay({ width, height, scale, offsetX = 0, offsetY = 0 }) {
  if (!scale || scale <= 0) return null;
  const gridPx = GRID_SNAP_INCHES * scale;
  if (gridPx < 1) return null;
  const lines = [];

  // Vertical lines
  for (let x = 0; x <= width; x += gridPx) {
    lines.push(
      <Line key={`v-${x}`} points={[x + offsetX, offsetY, x + offsetX, height + offsetY]} stroke="#d6d3cc" strokeWidth={0.5} />
    );
  }

  // Horizontal lines
  for (let y = 0; y <= height; y += gridPx) {
    lines.push(
      <Line key={`h-${y}`} points={[offsetX, y + offsetY, width + offsetX, y + offsetY]} stroke="#d6d3cc" strokeWidth={0.5} />
    );
  }

  return <Group>{lines}</Group>;
}
