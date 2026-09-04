import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const expectedRef = 'hcfixfhgmjnxbmkrhmhx';
const oldRef = 'wfjkuajzkotihcpsxxgz';
const expectedUrl = `https://${expectedRef}.supabase.co`;
const fourthwallUrl = 'https://uptime-lounge-shop.fourthwall.com';

const files = ['api/config.js','api/health.js','scripts/supabase-live-smoke.mjs'];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  assert.ok(text.includes(expectedUrl), `${file} is not pinned to the production Supabase project`);
  assert.ok(!text.includes(oldRef), `${file} still references the retired Supabase project`);
}

const config = await readFile('api/config.js', 'utf8');
const health = await readFile('api/health.js', 'utf8');
for (const [name, text] of [['api/config.js', config], ['api/health.js', health]]) {
  assert.ok(!/process\.env\.(?:VITE_)?SUPABASE_URL/.test(text), `${name} allows stale Supabase URL env vars to override production`);
  assert.ok(!/process\.env\.(?:VITE_)?SUPABASE_PUBLISHABLE_KEY/.test(text), `${name} allows stale publishable-key env vars to override production`);
  assert.ok(text.includes('Uptime Lounge'), `${name} must report the Uptime Lounge public brand`);
  assert.ok(text.includes(fourthwallUrl), `${name} must reference the Uptime Lounge Fourthwall shop`);
}
assert.ok(config.includes("merchProviderConfigured: true"), 'Production config must report connected Fourthwall provider');
assert.ok(config.includes("merchCatalogStatus: 'awaiting_products'"), 'Production config must represent the empty catalog honestly');
assert.ok(config.includes('merchCheckoutEnabled: false'), 'Production config must not expose merch checkout before products exist');

console.log('UPTIME LOUNGE PRODUCTION CONFIG CONTRACT: PASS');
