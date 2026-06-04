import express from 'express';
import multer from 'multer';
import {
  parseFloorplanWithPython,
  unavailableParseResult,
  buildFloorplanClientPayload,
} from '../services/floorplanParse.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/public/parse-floorplan — stateless parse, no auth, no DB writes.
// Used by guest users designing without an account.
router.post('/parse-floorplan', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  let parseResult;
  try {
    parseResult = await parseFloorplanWithPython(file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });
  } catch (pyErr) {
    parseResult = unavailableParseResult(pyErr);
  }

  res.json(buildFloorplanClientPayload(parseResult));
});

export default router;
