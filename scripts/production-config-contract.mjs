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

console.log('ROOT LOUNGE PRODUCTION SUPABASE CONFIG CONTRACT: PASS');
