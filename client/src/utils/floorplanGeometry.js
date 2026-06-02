function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  if (url.startsWith('/uploads/')) {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    return `${apiBase}${url}`;
  }
  return url;
}

export function normalizeGeometry(input = {}) {
  const type = input?.type === 'polygon' ? 'polygon' : 'rect';
  const bboxObj = input?.bbox || {};
  const x = toNumber(bboxObj.x, 0);
  const y = toNumber(bboxObj.y, 0);
  const width = Math.max(1, toNumber(bboxObj.width, 1));
  const height = Math.max(1, toNumber(bboxObj.height, 1));
  const points = Array.isArray(input?.points)
    ? input.points
        .map((pt) => ({ x: toNumber(pt?.x, 0), y: toNumber(pt?.y, 0) }))
        .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y))
    : [];

  return {
    type,
    bbox: { x, y, width, height },
    points,
    source: input?.source || 'confirmed',
  };
}

export function toBboxArray(geometry) {
  const g = normalizeGeometry(geometry);
  return [g.bbox.x, g.bbox.y, g.bbox.x + g.bbox.width, g.bbox.y + g.bbox.height];
}

export function projectFloorplanOverlays(project = null) {
  const floorplan = project?.floorplan || {};
  const imageUrl = normalizeImageUrl(floorplan?.imageUrl);
  const zones = Array.isArray(floorplan?.zones) ? floorplan.zones : [];
  const spaces = Array.isArray(project?.spaces) ? project.spaces : [];
  const zoneById = new Map(zones.map((z) => [z.id, z]));

  const overlays = spaces
    .map((space, index) => {
      const zone = zoneById.get(space.zoneId) || zoneById.get(space.zone_id) || null;
      const zoneGeometry = zone?.geometry ? normalizeGeometry(zone.geometry) : null;
      const spaceGeometry = space?.geometry ? normalizeGeometry(space.geometry) : null;
      const geometry = zoneGeometry || spaceGeometry;
      if (!geometry) return null;
      return {
        id: space.id || `space-${index}`,
        name: space.name || `Space ${index + 1}`,
        type: space.type === 'exterior' ? 'exterior' : 'interior',
        geometry,
      };
    })
    .filter(Boolean);

  if (overlays.length === 0) {
    return { imageUrl, overlays: [], bounds: null };
  }

  const bounds = overlays.reduce(
    (acc, item) => {
      const bbox = toBboxArray(item.geometry);
      return {
        maxX: Math.max(acc.maxX, bbox[2]),
        maxY: Math.max(acc.maxY, bbox[3]),
      };
    },
    { maxX: 1, maxY: 1 },
  );

  return {
    imageUrl,
    overlays,
    bounds: { width: Math.max(1, bounds.maxX), height: Math.max(1, bounds.maxY) },
  };
}
