import { Fragment } from 'react';
import { Group, Text } from 'react-konva';
import { segmentLengthInches } from '@/utils/roomWallMath';

/** Feet/inches label for wall runouts (e.g. 10'6"). */
export function formatInchesLabel(inches) {
  if (inches == null || Number.isNaN(inches)) return '—';
  const n = Math.round(inches);
  const ft = Math.floor(n / 12);
  const ins = n % 12;
  if (ft === 0) return `${ins}"`;
  if (ins === 0) return `${ft}'`;
  return `${ft}'${ins}"`;
}

export default function WallDimensionLabels({
  segments,
  roomOffsetX,
  roomOffsetY,
  pxPerInch,
  viewOriginX = 0,
  viewOriginY = 0,
  viewportScale = 1,
}) {
  if (!segments?.length) return null;

  const fs = Math.max(8, 10 / viewportScale);

  return (
    <Fragment>
      {segments.map((seg, i) => {
        const len = segmentLengthInches(seg);
        if (len < 1) return null;
        const midRoomX = (seg.start[0] + seg.end[0]) / 2;
        const midRoomY = (seg.start[1] + seg.end[1]) / 2;
        const mx = roomOffsetX + (midRoomX - viewOriginX) * pxPerInch;
        const my = roomOffsetY + (midRoomY - viewOriginY) * pxPerInch;
        const dx = seg.end[0] - seg.start[0];
        const dy = seg.end[1] - seg.start[1];
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const norm = len > 1e-6 ? Math.hypot(dx, dy) : 1;
        const nx = (-dy / norm) * (14 / viewportScale);
        const ny = (dx / norm) * (14 / viewportScale);
        const label = formatInchesLabel(len);
        const tw = Math.max(72, label.length * fs * 0.55);

        return (
          <Group key={i} x={mx + nx} y={my + ny} rotation={angle} listening={false}>
            <Text
              text={label}
              fontSize={fs}
              fill="#d6cbb8"
              align="center"
              width={tw}
              x={-tw / 2}
              y={-fs / 2}
              listening={false}
            />
          </Group>
        );
      })}
    </Fragment>
  );
}
