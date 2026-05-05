import { Group, Circle, Rect } from 'react-konva';
import { snapToGrid } from '@/utils/scale';
import { GRID_SNAP_INCHES } from '@/utils/constants';
import { MIN_ROOM_DIM_IN } from '@/utils/roomWallMath';

/**
 * Resize room width/depth from east, south, and south-east.
 * Room origin (0, 0) stays fixed in inch space.
 */
export default function RoomBoundsHandles({
  roomWidth,
  roomDepth,
  roomOffsetX,
  roomOffsetY,
  pxPerInch,
  viewOriginX,
  viewOriginY,
  viewportScale,
  enabled,
  onPreviewChange,
  onCommit,
}) {
  if (!enabled || !roomWidth || !roomDepth) return null;

  const ox = roomOffsetX + (0 - viewOriginX) * pxPerInch;
  const oy = roomOffsetY + (0 - viewOriginY) * pxPerInch;
  const rw = roomWidth * pxPerInch;
  const rh = roomDepth * pxPerInch;
  const r = 7 / viewportScale;
  const stroke = '#f59e0b';
  const fill = '#fff7ed';

  const dimsFromHandleCanvas = (cx, cy, lockW, lockD) => {
    const nw = lockW
      ? roomWidth
      : Math.max(MIN_ROOM_DIM_IN, snapToGrid((cx - ox) / pxPerInch, GRID_SNAP_INCHES));
    const nd = lockD
      ? roomDepth
      : Math.max(MIN_ROOM_DIM_IN, snapToGrid((cy - oy) / pxPerInch, GRID_SNAP_INCHES));
    return { width: nw, depth: nd };
  };

  const bubble = (e) => {
    e.cancelBubble = true;
  };

  const Handle = ({ x, y, lockW, lockD }) => (
    <Circle
      x={x}
      y={y}
      radius={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={2 / viewportScale}
      draggable
      onDragStart={bubble}
      onDragMove={(e) => {
        bubble(e);
        const dims = dimsFromHandleCanvas(e.target.x(), e.target.y(), lockW, lockD);
        onPreviewChange?.(dims);
        const px = ox + dims.width * pxPerInch;
        const py = oy + dims.depth * pxPerInch;
        if (!lockW && !lockD) e.target.position({ x: px, y: py });
        else if (!lockW) e.target.position({ x: px, y });
        else if (!lockD) e.target.position({ x, y: py });
      }}
      onDragEnd={(e) => {
        bubble(e);
        const dims = dimsFromHandleCanvas(e.target.x(), e.target.y(), lockW, lockD);
        onCommit(dims);
        onPreviewChange?.(null);
        const px = ox + dims.width * pxPerInch;
        const py = oy + dims.depth * pxPerInch;
        if (!lockW && !lockD) e.target.position({ x: px, y: py });
        else if (!lockW) e.target.position({ x: px, y });
        else if (!lockD) e.target.position({ x, y: py });
      }}
    />
  );

  return (
    <Group listening>
      <Rect
        x={ox}
        y={oy}
        width={rw}
        height={rh}
        stroke={stroke}
        strokeWidth={2 / viewportScale}
        dash={[8 / viewportScale, 6 / viewportScale]}
        fill="rgba(245,158,11,0.06)"
        listening={false}
      />
      <Handle x={ox + rw} y={oy + rh / 2} lockW={false} lockD />
      <Handle x={ox + rw / 2} y={oy + rh} lockW lockD={false} />
      <Handle x={ox + rw} y={oy + rh} lockW={false} lockD={false} />
    </Group>
  );
}
