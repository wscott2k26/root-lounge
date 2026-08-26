import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const expectedRef = 'hcfixfhgmjnxbmkrhmhx';
const oldRef = 'wfjkuajzkotihcpsxxgz';
const expectedUrl = `https://${expectedRef}.supabase.co`;

const files = [
  'api/config.js',
  'api/health.js',
  'scripts/supabase-live-smoke.mjs',
];

for (const file of files) {
  const text = await readFile(file, 'utf8');
  assert.ok(text.includes(expectedUrl), `${file} is not pinned to the Root Lounge production Supabase project`);
  assert.ok(!text.includes(oldRef), `${file} still references the retired Supabase project`);
}

const config = await readFile('api/config.js', 'utf8');
const health = await readFile('api/health.js', 'utf8');
for (const [name, text] of [['api/config.js', config], ['api/health.js', health]]) {
  assert.ok(!/process\.env\.(?:VITE_)?SUPABASE_URL/.test(text), `${name} allows stale Supabase URL environment variables to override the pinned production project`);
  assert.ok(!/process\.env\.(?:VITE_)?SUPABASE_PUBLISHABLE_KEY/.test(text), `${name} allows stale publishable-key environment variables to override the pinned production project`);
}

console.log('ROOT LOUNGE PRODUCTION SUPABASE CONFIG CONTRACT: PASS');
