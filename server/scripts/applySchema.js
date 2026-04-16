/**
 * Apply schema.sql to Supabase using multiple methods:
 * 1. Try pg-meta API (internal Supabase endpoint)
 * 2. Try direct psql connection
 * 3. Print instructions for manual SQL Editor paste
 *
 * Usage: node server/scripts/applySchema.js [DB_PASSWORD]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const schemaPath = path.resolve(__dirname, '../../supabase/schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

async function tryPgMeta() {
  // Try multiple internal endpoints
  const endpoints = [
    '/pg/query',
    '/pg-meta/default/query',
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${SUPABASE_URL}${ep}`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: schemaSql }),
      });
      const text = await res.text();
      if (res.ok && !text.includes('error') && !text.includes('invalid')) {
        console.log(`✅ Schema applied via ${ep}`);
        console.log(text.slice(0, 200));
        return true;
      }
      console.log(`  ${ep}: ${res.status} - ${text.slice(0, 100)}`);
    } catch (e) {
      console.log(`  ${ep}: ${e.message}`);
    }
  }
  return false;
}

async function tryRestRpc() {
  // Try creating tables via individual REST API calls using the RPC endpoint
  // First, check if we can create a simple function that creates tables
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const text = await res.text();
    console.log(`  RPC endpoint: ${res.status} - ${text.slice(0, 100)}`);
  } catch (e) {
    console.log(`  RPC: ${e.message}`);
  }
  return false;
}

async function verifyTables() {
  // Check if tables already exist
  const tables = ['providers', 'furniture_catalog', 'rooms', 'placements', 'layout_exports', 'chat_messages'];
  const results = {};

  for (const table of tables) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=count&limit=0`, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Prefer': 'count=exact',
        },
      });
      results[table] = res.ok;
    } catch {
      results[table] = false;
    }
  }
  return results;
}

async function main() {
  console.log('\n🔍 Checking if tables already exist...');
  const existing = await verifyTables();
  const allExist = Object.values(existing).every(v => v);

  if (allExist) {
    console.log('✅ All tables already exist!');
    for (const [t, ok] of Object.entries(existing)) {
      console.log(`  ${ok ? '✅' : '❌'} ${t}`);
    }
    return;
  }

  console.log('Tables status:');
  for (const [t, ok] of Object.entries(existing)) {
    console.log(`  ${ok ? '✅' : '❌'} ${t}`);
  }

  console.log('\n📋 Attempting to apply schema...');

  // Method 1: pg-meta API
  console.log('\nMethod 1: pg-meta API...');
  if (await tryPgMeta()) {
    const after = await verifyTables();
    if (Object.values(after).every(v => v)) {
      console.log('\n✅ All tables created successfully!');
      return;
    }
  }

  // Method 2: psql (if DB password provided)
  const dbPassword = process.argv[2];
  if (dbPassword) {
    console.log('\nMethod 2: psql...');
    const ref = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
    const connStr = `postgresql://postgres.${ref}:${encodeURIComponent(dbPassword)}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;
    const { execSync } = await import('child_process');
    try {
      const psqlPath = '/opt/homebrew/opt/libpq/bin/psql';
      execSync(`${psqlPath} "${connStr}" -f "${schemaPath}"`, { stdio: 'inherit', timeout: 30000 });
      console.log('✅ Schema applied via psql');
      return;
    } catch (e) {
      console.log(`  psql failed: ${e.message}`);
    }
  }

  // Method 3: Instructions
  console.log('\n' + '='.repeat(60));
  console.log('⚠️  Could not auto-apply schema. Please do ONE of:');
  console.log('='.repeat(60));
  console.log('\nOption A (easiest): Supabase SQL Editor');
  console.log('  1. Go to https://supabase.com/dashboard/project/' + SUPABASE_URL.replace('https://', '').replace('.supabase.co', '') + '/sql');
  console.log('  2. Paste the contents of supabase/schema.sql');
  console.log('  3. Click "Run"');
  console.log('\nOption B: Run this script with your DB password');
  console.log('  node server/scripts/applySchema.js YOUR_DB_PASSWORD');
  console.log('  (Find your DB password in Supabase Dashboard → Settings → Database)');
  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
