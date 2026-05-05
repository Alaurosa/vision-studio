import { useMemo } from 'react';

function getSpaceRoomId(space) {
  return space?.roomId ?? space?.room_id ?? null;
}

function getZoneBBox(zone) {
  if (Array.isArray(zone?.bbox) && zone.bbox.length === 4) return zone.bbox;
  return null;
}

function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  if (url.startsWith('/uploads/')) {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    return `${apiBase}${url}`;
  }
  return url;
}

function resolveFloorplanSource(projectSpaces, roomsById, selectedSpace = null) {
  const candidates = [];
  const selectedRid = getSpaceRoomId(selectedSpace);
  if (selectedRid && roomsById[selectedRid]) candidates.push(roomsById[selectedRid]);
  for (const space of Array.isArray(projectSpaces) ? projectSpaces : []) {
    const rid = getSpaceRoomId(space);
    if (rid && roomsById[rid]) candidates.push(roomsById[rid]);
  }
  const unique = [];
  const seen = new Set();
  for (const room of candidates) {
    if (!room?.id || seen.has(room.id)) continue;
    seen.add(room.id);
    unique.push(room);
  }
  return unique.find((room) => {
    const imageUrl = normalizeImageUrl(room.floor_plan_url || room.floorplan_url);
    const zones = Array.isArray(room.zones) ? room.zones : [];
    return Boolean(imageUrl && zones.length > 0);
  }) || null;
}

function buildOverlaySpaces(projectSpaces, sourceRoom) {
  const zones = Array.isArray(sourceRoom?.zones) ? sourceRoom.zones : [];
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  return (Array.isArray(projectSpaces) ? projectSpaces : []).map((space, index) => {
    const zone = zoneById.get(space.zoneId) || zoneById.get(space.zone_id) || null;
    const bbox = getZoneBBox(zone);
    return {
      id: space.id || `space-${index}`,
      name: space.name || `Space ${index + 1}`,
      type: space.type === 'exterior' ? 'exterior' : 'interior',
      bbox,
      missingLinkedRoom: Boolean(space.missingLinkedRoom),
    };
  });
}

export default function ProjectCanvas({
  projectSpaces = [],
  rooms = [],
  selectedSpaceId = null,
  selectedSpace = null,
  onSelectSpace,
}) {
  const roomsById = useMemo(
    () =>
      (Array.isArray(rooms) ? rooms : []).reduce((acc, room) => {
        acc[room.id] = room;
        return acc;
      }, {}),
    [rooms],
  );
  const sourceRoom = useMemo(
    () => resolveFloorplanSource(projectSpaces, roomsById, selectedSpace),
    [projectSpaces, roomsById, selectedSpace],
  );
  const imageUrl = useMemo(
    () => normalizeImageUrl(sourceRoom?.floor_plan_url || sourceRoom?.floorplan_url),
    [sourceRoom],
  );
  const overlaySpaces = useMemo(
    () => buildOverlaySpaces(projectSpaces, sourceRoom),
    [projectSpaces, sourceRoom],
  );
  const bounds = useMemo(() => {
    const boxes = overlaySpaces.map((s) => s.bbox).filter(Boolean);
    if (boxes.length === 0) return null;
    const maxX = Math.max(...boxes.map((b) => b[2]));
    const maxY = Math.max(...boxes.map((b) => b[3]));
    return { width: Math.max(1, maxX), height: Math.max(1, maxY) };
  }, [overlaySpaces]);

  return (
    <div className="relative h-full w-full bg-surface-800">
      {imageUrl && bounds ? (
        <div className="h-full w-full p-4">
          <svg className="h-full w-full" viewBox={`0 0 ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMid meet">
            <image href={imageUrl} x="0" y="0" width={bounds.width} height={bounds.height} />
            {overlaySpaces.map((space) => {
              const bbox = space.bbox;
              if (!bbox) return null;
              const [x1, y1, x2, y2] = bbox;
              const active = selectedSpaceId === space.id;
              const fill = space.type === 'exterior' ? '#2f4a62' : '#3d3a34';
              return (
                <g key={space.id} onClick={() => onSelectSpace?.(space.id)} style={{ cursor: 'pointer' }}>
                  <rect
                    x={x1}
                    y={y1}
                    width={Math.max(1, x2 - x1)}
                    height={Math.max(1, y2 - y1)}
                    fill={fill}
                    fillOpacity={active ? 0.3 : 0.18}
                    stroke={active ? '#d7ab68' : '#e6dac8'}
                    strokeWidth={active ? 3 : 1.5}
                  />
                  <text x={x1 + 8} y={y1 + 18} fill="#fff7ea" fontSize="12" fontWeight="600">
                    {space.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <div className="panel p-5 max-w-md text-center">
            <p className="eyebrow text-ink-500 mb-2">Floorplan Preview Unavailable</p>
            <p className="text-sm text-ink-600 leading-relaxed">
              Floorplan geometry needs confirmation. Return to Review Spaces to finalize the uploaded plan alignment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
