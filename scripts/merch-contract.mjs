import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = await readFile('api/config.js', 'utf8');
const health = await readFile('api/health.js', 'utf8');
const helper = await readFile('recovered-live/helper.js', 'utf8');

const retiredPhysicalStripeLinks = [
  'https://buy.stripe.com/8x28wRfsf0dgfxK049efC01',
  'https://buy.stripe.com/14AbJ3fsf1hk2KY049efC02',
  'https://buy.stripe.com/8x214p3Jx6BEgBO5otefC03',
];

assert.ok(config.includes("merchProvider: 'fourthwall'"), 'Config must identify Fourthwall as merch provider');
assert.ok(config.includes('merchProviderConfigured: true'), 'Config must expose connected Fourthwall provider');
assert.ok(config.includes('merchFulfillmentReady: true'), 'Config must expose provider fulfillment readiness');
assert.ok(config.includes("merchCatalogStatus: 'awaiting_products'"), 'Empty catalog must be an explicit awaiting_products state');
assert.ok(config.includes('merchCheckoutEnabled: false'), 'Physical checkout must remain off while catalog is empty');
assert.ok(config.includes('https://uptime-lounge-shop.fourthwall.com'), 'Config must expose the Uptime Lounge Fourthwall shop URL');

for (const url of retiredPhysicalStripeLinks) {
  assert.ok(!config.includes(url), 'Physical Stripe merch link must not be exposed by API config');
  assert.ok(!health.includes(url), 'Physical Stripe merch link must not be health-checked as a live product');
}

assert.ok(health.includes('merchProviderConfigured'), 'Health must report Fourthwall provider readiness');
assert.ok(health.includes('merchProviderReachable'), 'Deep health must report Fourthwall reachability');
assert.ok(health.includes('merchCheckoutEnabled: false'), 'Health must report merch checkout disabled while catalog is empty');
assert.ok(health.includes("merchCatalogStatus: 'awaiting_products'"), 'Health must keep catalog state informational');
assert.ok(helper.includes('Merch collection opening soon'), 'Funding runtime must explain empty catalog state');
assert.ok(helper.includes('merchStoreUrl'), 'Funding runtime must consume configured Fourthwall shop URL');
assert.ok(helper.includes("checkout('caffeine')"), 'Support contribution must remain available');
assert.ok(!helper.includes("checkout('oom_tee')") && !helper.includes("checkout('hoodie')") && !helper.includes("checkout('cap')"), 'Runtime overlay must not expose physical Stripe checkout');

console.log('UPTIME LOUNGE MERCH CONTRACT: PASS');
