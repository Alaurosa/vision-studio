import './config/env.js';  // Must be first — loads .env before any other imports
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import furnitureRoutes from './routes/furniture.js';
import layoutRoutes from './routes/layout.js';
import chatRoutes from './routes/chat.js';
import exportRoutes from './routes/export.js';
import recognitionRoutes from './routes/recognition.js';
import modelsRoutes from './routes/models.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173'],
  credentials: true,
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve locally-saved uploads when Supabase Storage is unavailable
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'vision-studio-server' }));

// Image proxy — serves external product images with proper CORS for WebGL textures
app.get('/api/proxy-image', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  // Security: only allow known furniture image domains
  try {
    const parsed = new URL(url);
    const allowed = [
      'www.ikea.com', 'images.ikea.com', 'ikea.com',
      'www.ashleyfurniture.com', 'ashleyfurniture.com',
      // IKEA CDN domains
      'a.storyblok.com',
      'hub.livingspaces.com',
    ];
    if (!allowed.some(domain => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain))) {
      return res.status(403).json({ error: 'Domain not allowed' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const resp = await fetch(url);
    if (!resp.ok) return res.status(resp.status).end();
    const ct = resp.headers.get('content-type') || 'image/jpeg';
    if (!ct.startsWith('image/')) return res.status(400).json({ error: 'Not an image' });
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=604800');
    const buffer = Buffer.from(await resp.arrayBuffer());
    res.send(buffer);
  } catch {
    res.status(502).json({ error: 'Proxy error' });
  }
});

// Database status check — helps diagnose setup issues
app.get('/api/status', async (req, res) => {
  const { supabaseAdmin } = await import('./services/supabase.js');
  const tables = ['providers', 'furniture_catalog', 'rooms', 'placements', 'layout_exports', 'chat_messages'];
  const results = {};
  let allOk = true;

  for (const table of tables) {
    const { data, error } = await supabaseAdmin.from(table).select('*').limit(0);
    results[table] = !error;
    if (error) allOk = false;
  }

  const ref = (process.env.SUPABASE_URL || '').replace('https://', '').replace('.supabase.co', '');
  res.json({
    database: allOk ? 'connected' : 'tables_missing',
    tables: results,
    setup_hint: allOk ? null : `Run schema.sql in Supabase SQL Editor: https://supabase.com/dashboard/project/${ref}/sql`,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/furniture', furnitureRoutes);
app.use('/api/layout', layoutRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/recognition', recognitionRoutes);
app.use('/api/models', modelsRoutes);

app.use(errorHandler);

app.listen(PORT, () => console.log(`Vision Studio backend running on :${PORT}`));
