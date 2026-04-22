import express from 'express';
import axios from 'axios';
import FormData from 'form-data';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { useDb, supabaseAdmin, fallback } from '../services/db.js';
import { saveFileLocally } from '../services/fileStorage.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const FURNITURE_LABELS = [
  'sofa', 'couch', 'chair', 'armchair', 'bed', 'desk', 'table', 'dining table',
  'coffee table', 'bookshelf', 'bookcase', 'dresser', 'nightstand', 'tv stand',
  'cabinet', 'window', 'door', 'rug', 'lamp',
];

// POST /api/recognition/room-photo/:room_id
router.post('/room-photo/:room_id', requireAuth, upload.single('file'), async (req, res) => {
  const { room_id } = req.params;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file provided' });
  const db = await useDb();

  try {
    let publicUrl = null;

    // 1. Upload photo to Supabase Storage if available
    if (db) {
      try {
        const fileName = `${req.user.id}/${room_id}/photo-${Date.now()}.jpg`;
        await supabaseAdmin.storage
          .from('room-photos')
          .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });
        const urlRes = supabaseAdmin.storage.from('room-photos').getPublicUrl(fileName);
        publicUrl = urlRes.data.publicUrl;
      } catch (storageErr) {
        console.warn('Room photo storage upload failed:', storageErr.message);
      }
    }

    // 2. Fallback: save locally
    if (!publicUrl) {
      const localPath = saveFileLocally(file.buffer, 'room-photos', file.originalname || 'photo.jpg');
      publicUrl = localPath;
    }

    // 3. Detect objects via Python service (send file bytes directly, don't depend on publicUrl)
    let detections = [];
    try {
      const form = new FormData();
      form.append('file', file.buffer, { filename: file.originalname || 'photo.jpg', contentType: file.mimetype });
      form.append('labels', FURNITURE_LABELS.join(','));

      const detectionRes = await axios.post(
        `${process.env.PYTHON_SERVICE_URL || 'http://localhost:5001'}/detect-objects`,
        form,
        { headers: form.getHeaders(), timeout: 60000 }
      );
      detections = detectionRes.data.detections || [];
    } catch (pyErr) {
      console.warn('Object detection unavailable:', pyErr.message);
    }

    // 4. Save to room
    if (db) {
      await supabaseAdmin
        .from('rooms')
        .update({
          room_photo_url: publicUrl,
          detected_objects: detections,
          updated_at: new Date().toISOString(),
        })
        .eq('id', room_id)
        .eq('user_id', req.user.id);
    } else {
      fallback.updateRoom(room_id, req.user.id, {
        room_photo_url: publicUrl,
        detected_objects: detections,
      });
    }

    res.json({ room_photo_url: publicUrl, detections });
  } catch (err) {
    console.error('Object recognition error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recognition/click-segment
router.post('/click-segment', requireAuth, async (req, res) => {
  const { image_url, click_x, click_y } = req.body;

  try {
    const form = new FormData();
    form.append('image_url', image_url);
    form.append(
      'bboxes',
      JSON.stringify([[click_x - 0.05, click_y - 0.05, click_x + 0.05, click_y + 0.05]])
    );

    const segRes = await axios.post(
      `${process.env.PYTHON_SERVICE_URL || 'http://localhost:5001'}/segment-room`,
      form,
      { headers: form.getHeaders(), timeout: 30000 }
    );

    const mask = segRes.data.masks?.[0] || null;
    res.json({ mask });
  } catch (err) {
    res.status(500).json({ mask: null, error: err.message });
  }
});

export default router;
