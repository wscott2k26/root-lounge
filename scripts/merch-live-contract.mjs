import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = await readFile('api/config.js', 'utf8');
const health = await readFile('api/health.js', 'utf8');
const helper = await readFile('recovered-live/helper.js', 'utf8');

assert.ok(config.includes("merchCatalogStatus: 'live'"), 'Config must expose a live Fourthwall catalog');
assert.ok(config.includes('merchCheckoutEnabled: true'), 'Config must enable Fourthwall merch checkout');
assert.ok(config.includes('https://uptime-lounge-shop.fourthwall.com'), 'Config must keep the live Uptime Lounge shop URL');

assert.ok(health.includes("merchCatalogStatus: 'live'"), 'Health must expose the live merch catalog');
assert.ok(health.includes('merchCheckoutEnabled: true'), 'Health must report merch checkout enabled');
assert.ok(health.includes("reason: 'live_catalog'"), 'Health diagnostics must report a live catalog');
assert.ok(health.includes('merchProviderReachable'), 'Deep health must continue probing Fourthwall reachability');

assert.ok(helper.includes('Shop the First Drop'), 'Funding UI must expose the live merch CTA');
assert.ok(helper.includes('Six Fourthwall-fulfilled products are live'), 'Funding UI must describe the live catalog truthfully');
assert.ok(!helper.includes('Merch collection opening soon'), 'Funding UI must not claim merch is still coming soon');
assert.ok(!helper.includes("checkout('oom_tee')") && !helper.includes("checkout('hoodie')") && !helper.includes("checkout('cap')"), 'Physical merch must stay off the retired Stripe checkout path');

console.log('UPTIME LOUNGE MERCH LIVE CONTRACT: PASS');
