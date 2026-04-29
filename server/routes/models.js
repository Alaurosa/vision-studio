import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { useDb, supabaseAdmin, fallback } from '../services/db.js';
import { log } from '../services/logger.js';
import axios from 'axios';

const router = express.Router();

const MESHY_BASE = 'https://api.meshy.ai/openapi/v2';
const meshyHeaders = () => ({ Authorization: `Bearer ${process.env.MESHY_API_KEY}` });

// In-memory cache: image_url -> { glb_url, status, taskId, error }
const modelCache = new Map();

/**
 * POST /api/models/generate
 * Body: { image_url, catalog_id?, name? }
 * Starts async 3D model generation from a product image.
 * Returns immediately with { status: 'pending', task_id } or { status: 'ready', glb_url }
 */
router.post('/generate', optionalAuth, async (req, res) => {
  const { image_url, catalog_id, name } = req.body;

  if (!image_url) {
    return res.status(400).json({ error: 'image_url is required' });
  }

  if (catalog_id && await useDb()) {
    try {
      const { data } = await supabaseAdmin
        .from('furniture_catalog')
        .select('model_url')
        .eq('id', catalog_id)
        .single();
      if (data?.model_url) {
        return res.json({ status: 'ready', glb_url: data.model_url });
      }
    } catch {
      // Fall through to generation.
    }
  }

  if (!process.env.MESHY_API_KEY) {
    return res.json({ status: 'unavailable', error: 'MESHY_API_KEY not configured' });
  }

  // Check cache first
  const cached = modelCache.get(image_url);
  if (cached) {
    if (cached.status === 'ready') return res.json({ status: 'ready', glb_url: cached.glb_url });
    if (cached.status === 'pending') return res.json({ status: 'pending', task_id: cached.taskId });
    if (cached.status === 'failed') return res.json({ status: 'failed', error: cached.error });
  }

  try {
    // Submit to Meshy image-to-3D
    const { data } = await axios.post(`${MESHY_BASE}/image-to-3d`, {
      image_url,
      enable_pbr: true,
      ai_model: 'meshy-4',
      topology: 'quad',
      target_polycount: 10000,
    }, { headers: meshyHeaders(), timeout: 30000 });

    const taskId = data.result;
    modelCache.set(image_url, { status: 'pending', taskId });

    // Start background polling
    pollTask(taskId, image_url, catalog_id).catch(err => {
      log.error('Model poll error', { error: err.message });
      modelCache.set(image_url, { status: 'failed', error: err.message });
    });

    res.json({ status: 'pending', task_id: taskId });
  } catch (err) {
    log.error('Meshy submit error', { error: err.message });
    res.status(500).json({ status: 'failed', error: err.response?.data?.message || err.message });
  }
});

/**
 * GET /api/models/status/:task_id
 * Poll the status of a 3D model generation task.
 */
router.get('/status/:task_id', optionalAuth, async (req, res) => {
  if (!process.env.MESHY_API_KEY) {
    return res.json({ status: 'unavailable' });
  }

  try {
    const { data } = await axios.get(`${MESHY_BASE}/image-to-3d/${req.params.task_id}`, {
      headers: meshyHeaders(),
      timeout: 15000,
    });

    const status = data.status;
    if (status === 'SUCCEEDED') {
      const glbUrl = data.model_urls?.glb;
      return res.json({ status: 'ready', glb_url: glbUrl, progress: 100 });
    }
    if (status === 'FAILED') {
      return res.json({ status: 'failed', error: 'Model generation failed' });
    }
    // IN_PROGRESS or PENDING
    return res.json({ status: 'pending', progress: data.progress || 0 });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

/**
 * GET /api/models/lookup?image_url=...
 * Quick lookup of a cached model by image URL.
 */
router.get('/lookup', optionalAuth, async (req, res) => {
  const { image_url } = req.query;
  if (!image_url) return res.json({ status: 'unknown' });

  const cached = modelCache.get(image_url);
  if (cached) return res.json(cached);

  res.json({ status: 'unknown' });
});

// Background polling helper
async function pollTask(taskId, imageUrl, catalogId) {
  const maxAttempts = 60; // 5 min max
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const { data } = await axios.get(`${MESHY_BASE}/image-to-3d/${taskId}`, {
        headers: meshyHeaders(),
        timeout: 15000,
      });

      if (data.status === 'SUCCEEDED') {
        const glbUrl = data.model_urls?.glb;
        modelCache.set(imageUrl, { status: 'ready', glb_url: glbUrl, taskId });

        // Save to catalog if we have a catalog_id
        if (catalogId) {
          try {
            const db = await useDb();
            if (db) {
              await supabaseAdmin.from('furniture_catalog')
                .update({ model_url: glbUrl })
                .eq('id', catalogId);
            }
          } catch {}
        }
        return;
      }
      if (data.status === 'FAILED') {
        modelCache.set(imageUrl, { status: 'failed', error: 'Generation failed', taskId });
        return;
      }
    } catch (err) {
      log.error('Poll error', { error: err.message });
    }
  }
  modelCache.set(imageUrl, { status: 'failed', error: 'Timed out', taskId });
}

export default router;
