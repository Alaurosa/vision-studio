/**
 * Normalize raw AI-detected rooms into zone objects with boundary-relative coordinates.
 */
export function normalizeZones(parseResult) {
  const boundary = parseResult?.boundary || { x: 0, y: 0 };
  return (parseResult?.rooms || []).map((room, index) => ({
    id: room.id || `zone-${index}`,
    name: room.label || `Room ${index + 1}`,
    polygon: (room.polygon || []).map(([x, y]) => [x - boundary.x, y - boundary.y]),
    bbox: Array.isArray(room.bbox) && room.bbox.length === 4
      ? [room.bbox[0] - boundary.x, room.bbox[1] - boundary.y, room.bbox[2] - boundary.x, room.bbox[3] - boundary.y]
      : room.bbox,
    width: room.width || (room.bbox?.[2] != null ? room.bbox[2] - room.bbox[0] : null),
    depth: room.depth || (room.bbox?.[3] != null ? room.bbox[3] - room.bbox[1] : null),
    confidence: room.confidence || null,
    width_inches: room.width_inches || null,
    depth_inches: room.depth_inches || null,
  }));
}
