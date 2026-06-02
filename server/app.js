import './config/env.js';  // Must be first — loads .env before any other imports
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/errorHandler.js';
import { log } from './services/logger.js';

import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import furnitureRoutes from './routes/furniture.js';
import layoutRoutes from './routes/layout.js';
import chatRoutes from './routes/chat.js';
import projectRoutes from './routes/projects.js';
import exportRoutes from './routes/export.js';
import recognitionRoutes from './routes/recognition.js';
import modelsRoutes from './routes/models.js';
import publicParseRoutes from './routes/publicParse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const startTime = Date.now();

export function createApp() {
  const app = express();

  // ---------- Security ----------
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false, // CSP handled by frontend
  }));

  // ---------- CORS ----------
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map(o => o.trim());

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));

  // ---------- Rate limiting ----------
  // Disabled in test mode so the suite doesn't trip over its own request volume.
  if (process.env.NODE_ENV !== 'test') {
    const apiLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests — please slow down.' },
    });
    app.use('/api/', apiLimiter);

    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many auth attempts — try again later.' },
    });
    app.use('/api/auth', authLimiter);
  }

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve locally-saved uploads when Supabase Storage is unavailable
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // ---------- Request logging ----------
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 2000 || res.statusCode >= 400) {
        log.warn(`${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });

  // ---------- Health & Status ----------
  app.get('/health', (req, res) => res.json({
    status: 'ok',
    service: 'vision-studio-server',
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.round((Date.now() - startTime) / 1000),
    environment: process.env.NODE_ENV || 'development',
  }));

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

  // Database status check — helps diagnose setup issues. Probes all tables in
  // parallel with a short per-table timeout so the endpoint returns within a
  // couple of seconds even when Supabase is unreachable.
  app.get('/api/status', async (req, res) => {
    const { supabaseAdmin, hasSupabaseCredentials } = await import('./services/supabase.js');
    const tables = ['providers', 'furniture_catalog', 'rooms', 'placements', 'layout_exports', 'chat_messages', 'projects', 'spaces'];

    // Short-circuit when credentials are obviously missing — no point dialing out.
    if (!hasSupabaseCredentials) {
      return res.json({
        database: 'unconfigured',
        tables: Object.fromEntries(tables.map((t) => [t, false])),
        uptime: Math.round((Date.now() - startTime) / 1000),
        setup_hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in root .env. The server is running in in-memory fallback mode.',
      });
    }

    const probe = async (table) => {
      try {
        const result = await Promise.race([
          supabaseAdmin.from(table).select('*').limit(0),
          new Promise((resolve) => setTimeout(() => resolve({ error: { message: 'timeout' } }), 3500)),
        ]);
        return !result?.error;
      } catch {
        return false;
      }
    };

    const probed = await Promise.all(tables.map((t) => probe(t)));
    const results = Object.fromEntries(tables.map((t, i) => [t, probed[i]]));
    const allOk = probed.every(Boolean);

    const ref = (process.env.SUPABASE_URL || '').replace('https://', '').replace('.supabase.co', '');
    res.json({
      database: allOk ? 'connected' : 'tables_missing',
      tables: results,
      uptime: Math.round((Date.now() - startTime) / 1000),
      setup_hint: allOk ? null : `Run schema.sql in Supabase SQL Editor: https://supabase.com/dashboard/project/${ref}/sql`,
    });
  });

  // ---------- Routes ----------
  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicParseRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/furniture', furnitureRoutes);
  app.use('/api/layout', layoutRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/export', exportRoutes);
  app.use('/api/recognition', recognitionRoutes);
  app.use('/api/models', modelsRoutes);

  app.use(errorHandler);

  return app;
}

export default createApp();
