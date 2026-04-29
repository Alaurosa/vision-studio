#!/usr/bin/env node

/**
 * Vision Studio — Setup Verification & Database Initialization
 * 
 * Usage: cd server && node scripts/setup.js
 * 
 * This script:
 * 1. Verifies all environment variables are set
 * 2. Tests Supabase connectivity
 * 3. Checks if database tables exist
 * 4. Seeds furniture catalog if tables exist but are empty
 */

import '../config/env.js';
import { createClient } from '@supabase/supabase-js';

const REQUIRED_VARS = ['SUPABASE_SERVICE_ROLE_KEY'];

const OPTIONAL_VARS = [
  'OPENAI_API_KEY',
  'REPLICATE_API_TOKEN',
  'MESHY_API_KEY',
];

const TABLES = ['providers', 'furniture_catalog', 'rooms', 'placements', 'layout_exports', 'chat_messages'];

async function main() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   Vision Studio — Setup Verification  ║');
  console.log('╚═══════════════════════════════════════╝\n');

  // 1. Check environment variables
  console.log('1. Environment Variables');
  let envOk = true;
  const resolvedUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const resolvedAnonKey =
    process.env.SUPABASE_PUBLIC_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  console.log(
    `   ${resolvedUrl ? '✅' : '❌'} SUPABASE_URL: ${resolvedUrl ? 'set (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL)' : 'MISSING (required)'}`
  );
  console.log(
    `   ${resolvedAnonKey ? '✅' : '⚠️ '} SUPABASE_PUBLIC_ANON_KEY: ${resolvedAnonKey ? 'set (SUPABASE_PUBLIC_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)' : 'not set (optional for setup script)'}`
  );
  if (!resolvedUrl) envOk = false;
  for (const v of REQUIRED_VARS) {
    const set = !!process.env[v];
    console.log(`   ${set ? '✅' : '❌'} ${v}: ${set ? 'set' : 'MISSING (required)'}`);
    if (!set) envOk = false;
  }
  for (const v of OPTIONAL_VARS) {
    const set = !!process.env[v];
    console.log(`   ${set ? '✅' : '⚠️ '} ${v}: ${set ? 'set' : 'not set (optional)'}`);
  }
  if (!envOk) {
    console.log('\n❌ Missing required env vars. Add them to the root .env file.');
    process.exit(1);
  }
  console.log();

  // 2. Test Supabase connection
  console.log('2. Supabase Connection');
  const sb = createClient(resolvedUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const { data, error } = await sb.auth.admin.listUsers({ perPage: 1 });
    if (error) throw error;
    console.log(`   ✅ Auth API works (${data.users.length} users)`);
  } catch (e) {
    console.log(`   ❌ Auth API failed: ${e.message}`);
    process.exit(1);
  }
  console.log();

  // 3. Check database tables
  console.log('3. Database Tables');
  let tablesExist = true;
  for (const table of TABLES) {
    const { error } = await sb.from(table).select('*').limit(0);
    const ok = !error;
    console.log(`   ${ok ? '✅' : '❌'} ${table}: ${ok ? 'accessible' : error.message}`);
    if (!ok) tablesExist = false;
  }
  console.log();

  if (!tablesExist) {
    const ref = (resolvedUrl || '').replace('https://', '').replace('.supabase.co', '');
    console.log('⚠️  Some tables are missing or not accessible.');
    console.log('');
    console.log('   To fix this, run the schema in Supabase SQL Editor:');
    console.log(`   👉 https://supabase.com/dashboard/project/${ref}/sql`);
    console.log('');
    console.log('   Steps:');
    console.log('   1. Open the link above');
    console.log('   2. Copy-paste the entire contents of supabase/schema.sql');
    console.log('   3. Click "Run"');
    console.log('   4. Re-run this script: cd server && node scripts/setup.js');
    process.exit(1);
  }

  // 4. Check if furniture catalog needs seeding
  console.log('4. Furniture Catalog');
  const { data: catalogItems, error: catErr } = await sb
    .from('furniture_catalog')
    .select('id')
    .limit(1);
  
  if (catErr) {
    console.log(`   ❌ Cannot access catalog: ${catErr.message}`);
  } else if (catalogItems.length === 0) {
    console.log('   ⚠️  Catalog is empty — running seed script...');
    try {
      const { seed } = await import('./seedFurniture.js');
      if (typeof seed === 'function') await seed();
      else console.log('   (seed function not exported — run manually: node scripts/seedFurniture.js)');
    } catch {
      console.log('   Run manually: cd server && node scripts/seedFurniture.js');
    }
  } else {
    console.log('   ✅ Catalog has data');
  }
  console.log();

  // 5. Check providers
  const { data: providers } = await sb.from('providers').select('id');
  console.log(`5. Providers: ${providers?.length || 0} configured`);
  console.log();

  console.log('═══════════════════════════════════════');
  console.log('✅ Setup verification complete!');
  console.log('');
  console.log('Start the app:');
  console.log('  Terminal 1: cd server && npm run dev');
  console.log('  Terminal 2: cd client && npm run dev');
  console.log('  Open: http://localhost:5173');
  console.log('═══════════════════════════════════════');
}

main().catch(e => {
  console.error('Setup error:', e.message);
  process.exit(1);
});
