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
assert.ok(config.includes("merchCatalogStatus: 'live'"), 'Catalog must be live after products and payout activation');
assert.ok(config.includes('merchCheckoutEnabled: true'), 'Fourthwall merch checkout must be enabled for the live catalog');
assert.ok(config.includes('https://uptime-lounge-shop.fourthwall.com'), 'Config must expose the Uptime Lounge Fourthwall shop URL');

for (const url of retiredPhysicalStripeLinks) {
  assert.ok(!config.includes(url), 'Physical Stripe merch link must not be exposed by API config');
  assert.ok(!health.includes(url), 'Physical Stripe merch link must not be health-checked as a live product');
}

assert.ok(health.includes('merchProviderConfigured'), 'Health must report Fourthwall provider readiness');
assert.ok(health.includes('merchProviderReachable'), 'Deep health must report Fourthwall reachability');
assert.ok(health.includes('merchCheckoutEnabled: true'), 'Health must report merch checkout enabled');
assert.ok(health.includes("merchCatalogStatus: 'live'"), 'Health must report live catalog state');
assert.ok(helper.includes('Uptime Lounge First Drop'), 'Funding runtime must expose the live merch collection');
assert.ok(helper.includes('Shop the First Drop'), 'Funding runtime must provide the live Fourthwall CTA');
assert.ok(helper.includes('merchStoreUrl'), 'Funding runtime must consume configured Fourthwall shop URL');
assert.ok(helper.includes("checkout('caffeine')"), 'Support contribution must remain available');
assert.ok(!helper.includes("checkout('oom_tee')") && !helper.includes("checkout('hoodie')") && !helper.includes("checkout('cap')"), 'Runtime overlay must not expose retired physical Stripe checkout');

console.log('UPTIME LOUNGE MERCH CONTRACT: PASS');
