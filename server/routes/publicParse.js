import express from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import { normalizeZones } from '../services/normalizeZones.js';
import { log } from '../services/logger.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/public/parse-floorplan — stateless parse, no auth, no DB writes.
// Used by guest users designing without an account.
router.post('/parse-floorplan', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  let parseResult = {
    rooms: [],
    walls: [],
    fallback: true,
    error: 'Python service unavailable — set room dimensions manually',
  };

  try {
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const pythonRes = await axios.post(
      `${process.env.PYTHON_SERVICE_URL || 'http://localhost:5001'}/parse-floorplan`,
      form,
      { headers: form.getHeaders(), timeout: 120000 }
    );
    parseResult = pythonRes.data;
  } catch (pyErr) {
    log.warn('Python service unavailable (public parse)', { error: pyErr.message });
  }

  // Normalize zones the same way the authenticated path does so the client can reuse the editor.
  const zones = normalizeZones(parseResult);

  // Compute scale / dimensions the same way rooms.js does so the client can present a to-scale canvas.
  const boundary = parseResult.boundary;
  const imgW = parseResult.image_width;
  const imgH = parseResult.image_height;
  let scale_px_per_inch = 1;
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

  res.json({
    parse_result: {
      ...parseResult,
      scale_px_per_inch,
    },
    zones,
    width,
    depth,
  });
});

export default router;
