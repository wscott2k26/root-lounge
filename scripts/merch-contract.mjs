import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = await readFile('api/config.js', 'utf8');
const health = await readFile('api/health.js', 'utf8');
const app1 = await readFile('recovered-live/app1.js', 'utf8');
const app3 = await readFile('recovered-live/app3.js', 'utf8');
const gui = await readFile('recovered-live/gui.js', 'utf8');

assert.ok(config.includes("merchProvider: 'fourthwall'"), 'Config must identify Fourthwall as merch provider');
assert.ok(config.includes('merchProviderConfigured'), 'Config must expose provider readiness');
assert.ok(config.includes('merchFulfillmentReady'), 'Config must expose fulfillment-provider readiness');
assert.ok(config.includes("merchCatalogStatus: 'awaiting_products'"), 'Empty catalog must be an explicit awaiting_products state');
assert.ok(config.includes('merchCheckoutEnabled: false'), 'Physical checkout must remain off while catalog is empty');
assert.ok(/https:\/\/uptime-lounge-shop\.fourthwall\.com/.test(config), 'Config must expose the Uptime Lounge Fourthwall shop URL');

assert.ok(health.includes('merchProviderConfigured'), 'Health must report Fourthwall provider readiness');
assert.ok(health.includes('merchProviderReachable'), 'Deep health must report Fourthwall reachability');
assert.ok(health.includes('merchCheckoutEnabled'), 'Health must report merch checkout state');
assert.ok(health.includes("merchCatalogStatus: 'awaiting_products'"), 'Health must keep catalog state informational');

for (const source of [app1, app3, gui]) {
  assert.ok(!source.includes("sku:'oom_tee'"), 'Physical merch Stripe SKU must not remain in runtime UI code');
  assert.ok(!source.includes("sku:'hoodie'"), 'Physical merch Stripe SKU must not remain in runtime UI code');
  assert.ok(!source.includes("sku:'cap'"), 'Physical merch Stripe SKU must not remain in runtime UI code');
}
assert.ok(app1.includes('Merch collection opening soon') || gui.includes('Merch collection opening soon'), 'Funding UI must explain empty catalog state');
assert.ok(app3.includes('merchStoreUrl') || gui.includes('merchStoreUrl'), 'Funding UI must route merch interest to Fourthwall');

console.log('UPTIME LOUNGE MERCH CONTRACT: PASS');
