import { Fragment } from 'react';
import { Line } from 'react-konva';

// Accepts several wall formats:
// - [[x, y], [x, y], ...] polygon in image pixel coords (normalized 0..imgW)
// - [{start:[x,y], end:[x,y]}, ...] segments in inches
// For a pixel polygon we map to the room box assuming the polygon is in
// image pixels and we already know room.width/depth in inches; we scale the
// polygon to the room box.
export default function WallOutline({ walls, pxPerInch, offsetX, offsetY, roomWidth, roomDepth, viewOriginX = 0, viewOriginY = 0 }) {
  if (!walls || walls.length === 0) return null;

  // Detect format
  if (Array.isArray(walls) && Array.isArray(walls[0]) && walls[0].length === 2) {
    // Polygon of image-pixel points — fit to room bbox
    const xs = walls.map((p) => p[0]);
    const ys = walls.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const roomPxW = (roomWidth || 120) * pxPerInch;
    const roomPxH = (roomDepth || 120) * pxPerInch;
    const pts = walls.flatMap(([x, y]) => [
      offsetX + (((x - minX) / w) * roomPxW) - viewOriginX * pxPerInch,
      offsetY + (((y - minY) / h) * roomPxH) - viewOriginY * pxPerInch,
    ]);
    return <Line points={pts} closed stroke="#100f0d" strokeWidth={2} />;
  }

  if (walls[0]?.start && walls[0]?.end) {
    return (
      <Fragment>
        {walls.map((seg, i) => (
          <Line
            key={i}
            points={[
              offsetX + (seg.start[0] - viewOriginX) * pxPerInch,
              offsetY + (seg.start[1] - viewOriginY) * pxPerInch,
              offsetX + (seg.end[0] - viewOriginX) * pxPerInch,
              offsetY + (seg.end[1] - viewOriginY) * pxPerInch,
            ]}
            stroke="#100f0d"
            strokeWidth={2}
          />
        ))}
      </Fragment>
    );
  }
  return null;
}
