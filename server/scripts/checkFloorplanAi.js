#!/usr/bin/env node
/**
 * Verify floorplan AI pipeline: OpenAI key, Python health, sample parse method.
 * Usage: node server/scripts/checkFloorplanAi.js [path/to/floorplan.jpg]
 */
import '../config/env.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const samplePath =
  process.argv[2] || path.join(root, 'e2e/fixtures/floorplan2.jpg');

const key = process.env.OPENAI_API_KEY || '';
const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

function maskKey(k) {
  if (!k) return '(not set)';
  if (k.length < 12) return '(too short)';
  return `${k.slice(0, 7)}…${k.slice(-4)}`;
}

console.log('--- Floorplan AI check ---\n');
console.log('OPENAI_API_KEY:', maskKey(key));
console.log('PYTHON_SERVICE_URL:', pythonUrl);

let ok = true;

try {
  const health = await axios.get(`${pythonUrl}/health`, { timeout: 5000 });
  console.log('\nPython /health:', JSON.stringify(health.data, null, 2));
  if (!health.data.openai_configured) {
    console.warn('\n⚠ Python does not see a valid OPENAI_API_KEY. Restart uvicorn after editing root .env');
    ok = false;
  }
} catch (e) {
  console.error('\n✗ Python not reachable:', e.message);
  console.error('  Start: cd python && uvicorn app:app --host 0.0.0.0 --port 5001 --reload');
  ok = false;
}

if (!fs.existsSync(samplePath)) {
  console.warn('\nSample image not found:', samplePath);
} else if (ok) {
  const form = new FormData();
  form.append('file', fs.createReadStream(samplePath), {
    filename: path.basename(samplePath),
    contentType: 'image/jpeg',
  });
  console.log('\nParsing sample:', samplePath);
  const res = await axios.post(`${pythonUrl}/parse-floorplan`, form, {
    headers: form.getHeaders(),
    timeout: 120000,
  });
  const d = res.data;
  console.log('  method:', d.method);
  console.log('  fallback:', d.fallback);
  console.log('  fallback_reason:', d.fallback_reason || '—');
  console.log('  rooms:', (d.rooms || []).length);
  console.log('  labels:', (d.rooms || []).slice(0, 6).map((r) => r.label).join(', '));
  if (d.method !== 'openai_vision_grid_snap' || d.fallback) {
    console.warn('\n⚠ Did not use OpenAI vision grid+snap — expect generic/poor room boxes.');
    ok = false;
  } else {
    console.log('\n✓ OpenAI vision floorplan pipeline OK');
  }
}

process.exit(ok ? 0 : 1);
