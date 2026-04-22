import { useMemo } from 'react';
import { Line } from 'react-konva';

export default function GridOverlay({ originX, originY, width, height, pxPerInch, gridInches = 6 }) {
  const lines = useMemo(() => {
    const step = gridInches * pxPerInch;
    if (step < 2 || width <= 0 || height <= 0) return [];

    const gridLines = [];
    // Vertical lines
    for (let x = 0; x <= width; x += step) {
      gridLines.push(
        <Line key={`gv-${x}`} points={[originX + x, originY, originX + x, originY + height]}
          stroke="#c4bfb6" strokeWidth={0.5} opacity={0.4} listening={false} />
      );
    }
    // Horizontal lines
    for (let y = 0; y <= height; y += step) {
      gridLines.push(
        <Line key={`gh-${y}`} points={[originX, originY + y, originX + width, originY + y]}
          stroke="#c4bfb6" strokeWidth={0.5} opacity={0.4} listening={false} />
      );
    }
    return gridLines;
  }, [originX, originY, width, height, pxPerInch, gridInches]);

  return <>{lines}</>;
}
