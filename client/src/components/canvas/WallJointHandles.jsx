import { useMemo, useRef } from 'react';
import { Group, Circle } from 'react-konva';
import { moveWallJoint } from '@/utils/roomWallMath';

function collectHandlePoints(walls) {
  const handles = [];
  if (!Array.isArray(walls)) return handles;
  walls.forEach((seg, segIndex) => {
    if (!seg?.start || !seg?.end) return;
    [
      { key: 'start', pt: seg.start },
      { key: 'end', pt: seg.end },
    ].forEach(({ key, pt }) => {
      const existing = handles.find((h) => pointsNearPoints(h.anchor, pt));
      if (existing) {
        existing.keys.push({ segIndex, key });
      } else {
        handles.push({ anchor: [...pt], keys: [{ segIndex, key }] });
      }
    });
  });
  return handles;
}

function pointsNearPoints(a, b, eps = 0.75) {
  return Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps;
}

function cloneWalls(walls) {
  return walls.map((s) => ({ start: [...s.start], end: [...s.end] }));
}

export default function WallJointHandles({
  walls,
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
  const handles = useMemo(() => collectHandlePoints(walls), [walls]);
  const dragBaseRef = useRef(null);

  if (!enabled || !walls?.length || handles.length === 0) return null;

  const r = 6 / viewportScale;
  const stroke = '#38bdf8';
  const fill = '#e0f2fe';

  const bubble = (e) => {
    e.cancelBubble = true;
  };

  return (
    <Group listening>
      {handles.map((h, i) => {
        const cx = roomOffsetX + (h.anchor[0] - viewOriginX) * pxPerInch;
        const cy = roomOffsetY + (h.anchor[1] - viewOriginY) * pxPerInch;
        const refKey = h.keys[0];

        return (
          <Circle
            key={`${h.anchor[0]}-${h.anchor[1]}-${i}`}
            x={cx}
            y={cy}
            radius={r}
            fill={fill}
            stroke={stroke}
            strokeWidth={2 / viewportScale}
            draggable
            onDragStart={(e) => {
              bubble(e);
              dragBaseRef.current = {
                walls: cloneWalls(walls),
                anchor: [...h.anchor],
              };
            }}
            onDragMove={(e) => {
              bubble(e);
              if (!dragBaseRef.current) return;
              const roomX = (e.target.x() - roomOffsetX) / pxPerInch + viewOriginX;
              const roomY = (e.target.y() - roomOffsetY) / pxPerInch + viewOriginY;
              const next = moveWallJoint(
                dragBaseRef.current.walls,
                dragBaseRef.current.anchor,
                [roomX, roomY],
                roomWidth,
                roomDepth,
              );
              onPreviewChange?.(next);
              const pt =
                refKey.key === 'start'
                  ? next[refKey.segIndex].start
                  : next[refKey.segIndex].end;
              e.target.position({
                x: roomOffsetX + (pt[0] - viewOriginX) * pxPerInch,
                y: roomOffsetY + (pt[1] - viewOriginY) * pxPerInch,
              });
            }}
            onDragEnd={(e) => {
              bubble(e);
              if (!dragBaseRef.current) return;
              const roomX = (e.target.x() - roomOffsetX) / pxPerInch + viewOriginX;
              const roomY = (e.target.y() - roomOffsetY) / pxPerInch + viewOriginY;
              const next = moveWallJoint(
                dragBaseRef.current.walls,
                dragBaseRef.current.anchor,
                [roomX, roomY],
                roomWidth,
                roomDepth,
              );
              onCommit(next);
              dragBaseRef.current = null;
              onPreviewChange?.(null);
            }}
          />
        );
      })}
    </Group>
  );
}
