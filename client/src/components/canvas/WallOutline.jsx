import { Line, Text, Group } from 'react-konva';

const ROOM_COLORS = [
  'rgba(59,130,246,0.12)',   // blue
  'rgba(16,185,129,0.12)',   // green
  'rgba(245,158,11,0.12)',   // amber
  'rgba(168,85,247,0.12)',   // purple
  'rgba(239,68,68,0.12)',    // red
  'rgba(14,165,233,0.12)',   // sky
  'rgba(251,146,60,0.12)',   // orange
  'rgba(34,197,94,0.12)',    // emerald
];

export default function WallOutline({ walls, scale, offsetX = 0, offsetY = 0, rooms }) {
  return (
    <>
      {/* Render individual room polygons if available */}
      {rooms && rooms.length > 0 && rooms.map((room, i) => {
        if (!room.polygon || !Array.isArray(room.polygon) || room.polygon.length < 3) return null;
        const points = room.polygon.flatMap(([x, y]) => [x * scale + offsetX, y * scale + offsetY]);
        const cx = room.polygon.reduce((s, p) => s + p[0], 0) / room.polygon.length * scale + offsetX;
        const cy = room.polygon.reduce((s, p) => s + p[1], 0) / room.polygon.length * scale + offsetY;
        return (
          <Group key={`room-${i}`}>
            <Line
              points={points}
              closed
              stroke={`hsl(${(i * 60) % 360}, 60%, 50%)`}
              strokeWidth={1.5}
              dash={[4, 2]}
              fill={ROOM_COLORS[i % ROOM_COLORS.length]}
            />
            <Text
              x={cx - 30}
              y={cy - 6}
              text={room.label || `Room ${i + 1}`}
              fontSize={10}
              fill={`hsl(${(i * 60) % 360}, 60%, 40%)`}
              align="center"
              width={60}
            />
          </Group>
        );
      })}

      {/* Render overall wall boundary */}
      {walls && Array.isArray(walls) && walls.length > 0 && (() => {
        // Polygon format: [[x,y], [x,y], ...]
        if (Array.isArray(walls[0]) && typeof walls[0][0] === 'number') {
          const points = walls.flatMap(([x, y]) => [x * scale + offsetX, y * scale + offsetY]);
          return (
            <Line
              points={points}
              closed
              stroke="#333"
              strokeWidth={3}
              fill="rgba(245,244,240,0.3)"
            />
          );
        }

        // Line segment format: [{start, end}, ...]
        if (walls[0] && walls[0].start) {
          return walls.map((wall, i) => (
            <Line
              key={i}
              points={[
                wall.start[0] * scale + offsetX,
                wall.start[1] * scale + offsetY,
                wall.end[0] * scale + offsetX,
                wall.end[1] * scale + offsetY,
              ]}
              stroke="#333"
              strokeWidth={3}
            />
          ));
        }

        return null;
      })()}
    </>
  );
}
