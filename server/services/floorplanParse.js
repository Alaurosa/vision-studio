import axios from 'axios';
import FormData from 'form-data';
import { normalizeZones } from './normalizeZones.js';
import { log } from './logger.js';

const PYTHON_PARSE_PATH = '/parse-floorplan';
const PARSE_TIMEOUT_MS = 120_000;

const UNAVAILABLE_PARSE = {
  rooms: [],
  walls: [],
  fallback: true,
  method: 'unavailable',
  fallback_reason: 'python_service_unreachable',
  error:
    'Python AI service unavailable. Start it with: cd python && uvicorn app:app --host 0.0.0.0 --port 5001 --reload',
};

/**
 * Call the Python microservice GPT/OpenCV floorplan parser.
 * @param {Buffer} fileBuffer
 * @param {{ filename: string, contentType: string }} meta
 */
export async function parseFloorplanWithPython(fileBuffer, { filename, contentType }) {
  const form = new FormData();
  form.append('file', fileBuffer, { filename, contentType });

  const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
  const { data } = await axios.post(`${pythonUrl}${PYTHON_PARSE_PATH}`, form, {
    headers: form.getHeaders(),
    timeout: PARSE_TIMEOUT_MS,
  });
  return data;
}

/**
 * @param {Error} err
 */
export function unavailableParseResult(err) {
  log.warn('Python floorplan service unavailable', {
    error: err?.message,
    hint: 'cd python && uvicorn app:app --host 0.0.0.0 --port 5001 --reload',
  });
  return { ...UNAVAILABLE_PARSE };
}

/**
 * @param {object} parseResult raw Python payload
 */
export function usedOpenAiVision(parseResult) {
  const method = parseResult?.method || 'unknown';
  return method === 'openai_vision_grid_snap' && !parseResult?.fallback;
}

/**
 * Normalize zones + room dimensions for client RoomEditor / Upload flow.
 * @param {object} parseResult
 */
export function buildFloorplanClientPayload(parseResult) {
  const zones = normalizeZones(parseResult);
  const method = parseResult.method || 'unknown';
  const openai_vision = usedOpenAiVision(parseResult);

  if (!openai_vision) {
    log.warn('Floorplan parse did not use OpenAI vision', {
      method,
      fallback: parseResult.fallback,
      fallback_reason: parseResult.fallback_reason || parseResult.error,
      room_count: (parseResult.rooms || []).length,
    });
  }

  const boundary = parseResult.boundary;
  const imgW = parseResult.image_width;
  const imgH = parseResult.image_height;
  let scale_px_per_inch = parseResult.scale_px_per_inch || 1;
  let width = null;
  let depth = null;

  if (boundary && boundary.w > 0 && imgW && imgH) {
    width = Math.round(boundary.w);
    depth = Math.round(boundary.h);
    if (parseResult.total_width_inches && parseResult.total_width_inches > 0) {
      scale_px_per_inch = boundary.w / parseResult.total_width_inches;
      width = Math.round(parseResult.total_width_inches);
      depth = Math.round(boundary.h / scale_px_per_inch);
    } else if (parseResult.total_depth_inches && parseResult.total_depth_inches > 0) {
      scale_px_per_inch = boundary.h / parseResult.total_depth_inches;
      depth = Math.round(parseResult.total_depth_inches);
      width = Math.round(boundary.w / scale_px_per_inch);
    }
  }

  return {
    zones,
    width,
    depth,
    parse_method: method,
    openai_vision,
    parse_result: {
      ...parseResult,
      zones,
      scale_px_per_inch,
    },
  };
}

/**
 * Room DB updates from a successful parse (authenticated upload path).
 * @param {object} parseResult
 */
export function buildRoomUpdatesFromParse(parseResult) {
  const updates = {};
  const zones = normalizeZones(parseResult);

  if (parseResult.walls && parseResult.walls.length > 0) {
    updates.walls = parseResult.boundary
      ? parseResult.walls.map(([x, y]) => [x - parseResult.boundary.x, y - parseResult.boundary.y])
      : parseResult.walls;
  }

  const boundary = parseResult.boundary;
  const imgW = parseResult.image_width;
  const imgH = parseResult.image_height;
  if (boundary && boundary.w > 0 && imgW && imgH) {
    let calcScale = 1.0;
    let roomW = Math.round(boundary.w);
    let roomH = Math.round(boundary.h);

    if (parseResult.total_width_inches && parseResult.total_width_inches > 0) {
      calcScale = boundary.w / parseResult.total_width_inches;
      roomW = Math.round(parseResult.total_width_inches);
      roomH = Math.round(boundary.h / calcScale);
    } else if (parseResult.total_depth_inches && parseResult.total_depth_inches > 0) {
      calcScale = boundary.h / parseResult.total_depth_inches;
      roomH = Math.round(parseResult.total_depth_inches);
      roomW = Math.round(boundary.w / calcScale);
    }

    updates.width = roomW;
    updates.depth = roomH;
    updates.scale_px_per_inch = calcScale;
  }

  if (parseResult.rooms || parseResult.boundary) {
    if (zones.length > 0) {
      updates.zones = zones;
    }
    updates.detected_objects = {
      rooms: parseResult.rooms || [],
      zones,
      boundary: parseResult.boundary || null,
      wall_segments: parseResult.wall_segments || [],
      method: parseResult.method || 'unknown',
      image_width: imgW,
      image_height: imgH,
    };
  }

  return updates;
}
