/**
 * Apply schema.sql to Supabase.
 * Tries pg-meta API first, then psql, then prints manual instructions.
 *
 * Usage: node server/scripts/applySchema.js [DB_PASSWORD]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const schemaPath = path.resolve(__dirname, '../../supabase/schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

const TABLES = ['providers', 'furniture_catalog', 'rooms', 'placements', 'layout_exports', 'chat_messages'];

async function verifyTables() {
  const results = {};
  for (const table of TABLES) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=count&limit=0`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'count=exact' },
      });
      results[table] = res.ok;
    } catch { results[table] = false; }
  }
  return results;
}

async function main() {
  const existing = await verifyTables();
  if (Object.values(existing).every(Boolean)) {
    console.log('✅ All tables already exist!');
    return;
  }

  console.log('Tables:', Object.entries(existing).map(([t, ok]) => `${ok ? '✅' : '❌'} ${t}`).join(', '));

  // Method 1: pg-meta API
  for (const ep of ['/pg/query', '/pg-meta/default/query']) {
    try {
      const res = await fetch(`${SUPABASE_URL}${ep}`, {
        method: 'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: schemaSql }),
      });
      if (res.ok) {
        const after = await verifyTables();
        if (Object.values(after).every(Boolean)) { console.log('✅ Schema applied!'); return; }
      }
    } catch {}
  }

  // Method 2: psql
  const dbPassword = process.argv[2];
  if (dbPassword) {
    const ref = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
    const connStr = `postgresql://postgres.${ref}:${encodeURIComponent(dbPassword)}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;
    try {
      const { execSync } = await import('child_process');
      execSync(`psql "${connStr}" -f "${schemaPath}"`, { stdio: 'inherit', timeout: 30000 });
      console.log('✅ Schema applied via psql');
      return;
    } catch {}
  }

  // Manual instructions
  const ref = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
  console.log(`\n⚠️  Paste supabase/schema.sql into: https://supabase.com/dashboard/project/${ref}/sql`);
}

main().catch(console.error);
