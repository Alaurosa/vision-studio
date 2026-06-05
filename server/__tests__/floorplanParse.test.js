import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  buildFloorplanClientPayload,
  usedOpenAiVision,
  unavailableParseResult,
  parseFloorplanWithPython,
} from '../services/floorplanParse.js';

vi.mock('axios');

describe('floorplanParse service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks OpenAI vision when method is openai_vision_grid_snap', () => {
    const payload = buildFloorplanClientPayload({
      method: 'openai_vision_grid_snap',
      fallback: false,
      rooms: [{ label: 'Living Room', bbox: [0, 0, 100, 80], polygon: [[0, 0], [100, 0], [100, 80], [0, 80]] }],
      boundary: { x: 0, y: 0, w: 200, h: 150 },
      image_width: 200,
      image_height: 150,
      total_width_inches: 240,
      total_depth_inches: 180,
    });

    expect(usedOpenAiVision(payload.parse_result)).toBe(true);
    expect(payload.openai_vision).toBe(true);
    expect(payload.parse_method).toBe('openai_vision_grid_snap');
    expect(payload.zones.length).toBe(1);
    expect(payload.parse_result.zones.length).toBe(1);
    expect(payload.zones[0].name).toBe('Living Room');
  });

  it('returns unavailable payload when Python is down', () => {
    const payload = buildFloorplanClientPayload(unavailableParseResult(new Error('ECONNREFUSED')));
    expect(payload.parse_method).toBe('unavailable');
    expect(payload.openai_vision).toBe(false);
    expect(payload.parse_result.fallback).toBe(true);
  });

  it('parseFloorplanWithPython posts multipart to PYTHON_SERVICE_URL', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { method: 'openai_vision_grid_snap', rooms: [], fallback: false },
    });
    process.env.PYTHON_SERVICE_URL = 'http://127.0.0.1:5001';

    await parseFloorplanWithPython(Buffer.from('fake'), {
      filename: 'plan.jpg',
      contentType: 'image/jpeg',
    });

    expect(axios.post).toHaveBeenCalledWith(
      'http://127.0.0.1:5001/parse-floorplan',
      expect.anything(),
      expect.objectContaining({ timeout: 120_000 }),
    );
  });
});
