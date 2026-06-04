import { getApiBaseUrl } from '@/utils/apiBase';

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  if (url.startsWith('/uploads/')) {
    const apiBase = getApiBaseUrl();
    return apiBase ? `${apiBase}${url}` : url;
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

/** @param {Array<{ bbox?: number[] }>} zones */
export function zonesBoundingExtents(zones) {
  if (!Array.isArray(zones) || zones.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const z of zones) {
    const b = z?.bbox;
    if (!Array.isArray(b) || b.length !== 4) continue;
    minX = Math.min(minX, b[0], b[2]);
    minY = Math.min(minY, b[1], b[3]);
    maxX = Math.max(maxX, b[0], b[2]);
    maxY = Math.max(maxY, b[1], b[3]);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Server `normalizeZones` stores coords relative to parse boundary origin.
 * RoomEditor / SVG use full image pixel space (0…imageWidth, 0…imageHeight).
 */
/** Inverse of zonesToImagePixels — for room DB rows that use boundary-relative coords. */
export function zonesToBoundaryRelative(zones, boundary) {
  if (!Array.isArray(zones) || zones.length === 0) return [];
  const ox = toNumber(boundary?.x, 0);
  const oy = toNumber(boundary?.y, 0);
  if (ox === 0 && oy === 0) return zones;

  return zones.map((z, index) => {
    const bbox =
      Array.isArray(z?.bbox) && z.bbox.length === 4
        ? [z.bbox[0] - ox, z.bbox[1] - oy, z.bbox[2] - ox, z.bbox[3] - oy]
        : z.bbox;
    const polygon = Array.isArray(z?.polygon)
      ? z.polygon.map(([x, y]) => [x - ox, y - oy])
      : z.polygon;
    let geometry = z.geometry;
    if (geometry?.bbox) {
      geometry = {
        ...geometry,
        bbox: {
          x: Math.max(0, toNumber(geometry.bbox.x, 0) - ox),
          y: Math.max(0, toNumber(geometry.bbox.y, 0) - oy),
          width: toNumber(geometry.bbox.width, 1),
          height: toNumber(geometry.bbox.height, 1),
        },
        points: Array.isArray(geometry.points)
          ? geometry.points.map((pt) => ({
              x: toNumber(pt.x, 0) - ox,
              y: toNumber(pt.y, 0) - oy,
            }))
          : geometry.points,
      };
    }
    return {
      ...z,
      id: z.id || `zone-${index}`,
      bbox,
      polygon,
      geometry,
    };
  });
}

export function zonesToImagePixels(zones, boundary) {
  if (!Array.isArray(zones) || zones.length === 0) return [];
  const ox = toNumber(boundary?.x, 0);
  const oy = toNumber(boundary?.y, 0);
  if (ox === 0 && oy === 0) return zones;

  return zones.map((z, index) => {
    const bbox =
      Array.isArray(z?.bbox) && z.bbox.length === 4
        ? [z.bbox[0] + ox, z.bbox[1] + oy, z.bbox[2] + ox, z.bbox[3] + oy]
        : z.bbox;
    const polygon = Array.isArray(z?.polygon)
      ? z.polygon.map(([x, y]) => [x + ox, y + oy])
      : z.polygon;
    let geometry = z.geometry;
    if (geometry?.bbox) {
      geometry = {
        ...geometry,
        bbox: {
          x: toNumber(geometry.bbox.x, 0) + ox,
          y: toNumber(geometry.bbox.y, 0) + oy,
          width: toNumber(geometry.bbox.width, 1),
          height: toNumber(geometry.bbox.height, 1),
        },
        points: Array.isArray(geometry.points)
          ? geometry.points.map((pt) => ({
              x: toNumber(pt.x, 0) + ox,
              y: toNumber(pt.y, 0) + oy,
            }))
          : geometry.points,
      };
    }
    return {
      ...z,
      id: z.id || `zone-${index}`,
      name: z.name || z.label || `Room ${index + 1}`,
      bbox,
      polygon,
      geometry,
    };
  });
}

/**
 * Whether zones look like boundary-relative (not full image) coordinates.
 */
export function zonesLookBoundaryRelative(zones, boundary) {
  if (!boundary || !Array.isArray(zones) || zones.length === 0) return false;
  const ox = toNumber(boundary.x, 0);
  const oy = toNumber(boundary.y, 0);
  if (ox === 0 && oy === 0) return false;

  const bw = toNumber(boundary.w, 0);
  const bh = toNumber(boundary.h, 0);
  if (bw <= 0 || bh <= 0) return false;

  const { minX, minY, maxX, maxY } = zonesBoundingExtents(zones);
  if (maxX > bw + 4 || maxY > bh + 4) return false;

  return minX >= -2 && minY >= -2 && maxX <= bw + 8 && maxY <= bh + 8;
}

/**
 * Zones for RoomEditor: prefer raw GPT `rooms` (image pixels), else lift normalized `zones`.
 */
export function resolveEditorZonesFromParse(parseResult = {}) {
  const rooms = Array.isArray(parseResult.rooms) ? parseResult.rooms : [];
  const zones = Array.isArray(parseResult.zones) ? parseResult.zones : [];
  const boundary = parseResult.boundary || null;
  const imageWidth = toNumber(parseResult.image_width, 0);
  const imageHeight = toNumber(parseResult.image_height, 0);

  if (rooms.length > 0) {
    return rooms;
  }

  if (zones.length === 0) return [];

  if (zonesLookBoundaryRelative(zones, boundary)) {
    return zonesToImagePixels(zones, boundary);
  }

  return zones;
}

/** Room width/depth in inches from parse metadata or zone pixel extents. */
export function roomDimensionsFromParse(parseResult = {}, zones = [], scalePxPerInch = 1) {
  const scale = scalePxPerInch > 0 ? scalePxPerInch : 1;
  const boundary = parseResult?.boundary;
  if (boundary?.w > 0 && boundary?.h > 0) {
    if (parseResult.total_width_inches > 0) {
      const calcScale = boundary.w / parseResult.total_width_inches;
      return {
        roomWidth: Math.round(parseResult.total_width_inches),
        roomDepth: Math.round(boundary.h / calcScale),
        scalePxPerInch: calcScale,
      };
    }
    if (parseResult.total_depth_inches > 0) {
      const calcScale = boundary.h / parseResult.total_depth_inches;
      return {
        roomWidth: Math.round(boundary.w / calcScale),
        roomDepth: Math.round(parseResult.total_depth_inches),
        scalePxPerInch: calcScale,
      };
    }
    return {
      roomWidth: Math.round(boundary.w / scale),
      roomDepth: Math.round(boundary.h / scale),
      scalePxPerInch: scale,
    };
  }
  const { minX, minY, maxX, maxY } = zonesBoundingExtents(zones);
  return {
    roomWidth: Math.max(1, Math.round((maxX - minX) / scale)),
    roomDepth: Math.max(1, Math.round((maxY - minY) / scale)),
    scalePxPerInch: scale,
  };
}

export function getFloorplanImageMeta(parseResult = {}, fallbackZones = []) {
  const imageWidth = toNumber(parseResult.image_width, 0);
  const imageHeight = toNumber(parseResult.image_height, 0);
  if (imageWidth > 0 && imageHeight > 0) {
    return {
      imageWidth,
      imageHeight,
      boundary: parseResult.boundary || null,
    };
  }
  const { maxX, maxY } = zonesBoundingExtents(fallbackZones);
  return {
    imageWidth: Math.max(1, maxX),
    imageHeight: Math.max(1, maxY),
    boundary: parseResult.boundary || null,
  };
}

/**
 * Zones saved on project.floorplan — ensure image pixel space for display.
 */
export function ensureFloorplanZonesInImageSpace(zones, floorplan = {}) {
  if (!Array.isArray(zones) || zones.length === 0) return [];

  const imageWidth = toNumber(floorplan.imageWidth, 0);
  const imageHeight = toNumber(floorplan.imageHeight, 0);
  const boundary = floorplan.boundary || null;

  if (floorplan.coordinateSpace === 'imagePixels') {
    return zones;
  }

  if (zonesLookBoundaryRelative(zones, boundary)) {
    const shifted = zonesToImagePixels(zones, boundary);
    const { maxX, maxY } = zonesBoundingExtents(shifted);
    if (imageWidth > 0 && maxX > imageWidth * 1.05) return zones;
    if (imageHeight > 0 && maxY > imageHeight * 1.05) return zones;
    return shifted;
  }

  return zones;
}

export function projectFloorplanOverlays(project = null) {
  const floorplan = project?.floorplan || {};
  const imageUrl = normalizeImageUrl(floorplan?.imageUrl);
  const rawZones = Array.isArray(floorplan?.zones) ? floorplan.zones : [];
  const zones = ensureFloorplanZonesInImageSpace(rawZones, floorplan);
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

  const imageWidth = toNumber(floorplan.imageWidth, 0);
  const imageHeight = toNumber(floorplan.imageHeight, 0);

  const extents = zonesBoundingExtents(
    overlays.map((o) => ({ bbox: toBboxArray(o.geometry) })),
  );

  const bounds = {
    width: imageWidth > 0 ? imageWidth : Math.max(1, extents.maxX),
    height: imageHeight > 0 ? imageHeight : Math.max(1, extents.maxY),
  };

  return {
    imageUrl,
    overlays,
    bounds,
  };
}
