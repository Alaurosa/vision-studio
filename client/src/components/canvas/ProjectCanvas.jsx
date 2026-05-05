import { useMemo } from 'react';
import { Stage, Layer, Rect, Text } from 'react-konva';

function buildProjectLayout(projectSpaces = [], roomsById = {}) {
  const spaces = Array.isArray(projectSpaces) ? projectSpaces : [];
  const gap = 24;
  const maxRowWidth = 900;
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  const placed = spaces.map((space, index) => {
    const rid = space.roomId ?? space.room_id ?? null;
    const linkedRoom = rid ? roomsById[rid] : null;
    const width = Math.max(120, Number(linkedRoom?.width) || (space.type === 'exterior' ? 280 : 220));
    const depth = Math.max(96, Number(linkedRoom?.depth) || (space.type === 'exterior' ? 200 : 160));
    if (x > 0 && x + width > maxRowWidth) {
      x = 0;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    const rect = { x, y, width, depth };
    x += width + gap;
    rowHeight = Math.max(rowHeight, depth);
    return {
      id: space.id || `space-${index}`,
      name: space.name || `Space ${index + 1}`,
      type: space.type === 'exterior' ? 'exterior' : 'interior',
      missingLinkedRoom: Boolean(space.missingLinkedRoom) || (rid && !linkedRoom),
      ...rect,
    };
  });

  const totalW = Math.max(700, ...placed.map((p) => p.x + p.width + 40));
  const totalH = Math.max(420, ...placed.map((p) => p.y + p.depth + 40));
  return { placed, totalW, totalH };
}

export default function ProjectCanvas({ projectSpaces = [], rooms = [], selectedSpaceId = null, onSelectSpace }) {
  const roomsById = useMemo(
    () =>
      (Array.isArray(rooms) ? rooms : []).reduce((acc, room) => {
        acc[room.id] = room;
        return acc;
      }, {}),
    [rooms],
  );
  const { placed, totalW, totalH } = useMemo(
    () => buildProjectLayout(projectSpaces, roomsById),
    [projectSpaces, roomsById],
  );

  return (
    <div className="relative h-full w-full bg-surface-800">
      <div className="absolute left-4 top-4 z-10 text-xs font-mono text-surface-400">
        Full floorplan preview ({placed.length} spaces)
      </div>
      <Stage width={Math.max(totalW, 900)} height={Math.max(totalH, 520)} draggable>
        <Layer>
          {placed.map((space) => {
            const active = selectedSpaceId === space.id;
            const fill = space.type === 'exterior' ? '#2f4a62' : '#3d3a34';
            const stroke = active ? '#d7ab68' : '#64605a';
            return (
              <Rect
                key={`${space.id}-rect`}
                x={space.x}
                y={space.y}
                width={space.width}
                height={space.depth}
                fill={fill}
                opacity={active ? 0.85 : 0.62}
                stroke={stroke}
                strokeWidth={active ? 3 : 1.5}
                onClick={() => onSelectSpace?.(space.id)}
              />
            );
          })}
          {placed.map((space) => (
            <Text
              key={`${space.id}-label`}
              x={space.x + 10}
              y={space.y + 10}
              width={space.width - 20}
              text={`${space.name}\n${space.type === 'exterior' ? 'Exterior' : 'Interior'}${
                space.missingLinkedRoom ? ' • Needs room link' : ''
              }`}
              fontSize={13}
              fill="#f7f2ea"
            />
          ))}
        </Layer>
      </Stage>
      {placed.length === 0 && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="eyebrow text-surface-400">No spaces yet</p>
        </div>
      )}
    </div>
  );
}
