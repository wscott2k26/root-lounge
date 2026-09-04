import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = await readFile('api/config.js', 'utf8');
const app3 = await readFile('recovered-live/app3.js', 'utf8');
const gui = await readFile('recovered-live/gui.js', 'utf8');
const schema = await readFile('supabase/schema.sql', 'utf8');
let webhook = '';
try {
  webhook = await readFile('supabase/functions/root-lounge-stripe-webhook/index.ts', 'utf8');
} catch {}

const links = {
  caffeine: 'https://donate.stripe.com/4gM8wR2Ftf8agBO5otefC00',
  oom_tee: 'https://buy.stripe.com/8x28wRfsf0dgfxK049efC01',
  hoodie: 'https://buy.stripe.com/14AbJ3fsf1hk2KY049efC02',
  cap: 'https://buy.stripe.com/8x214p3Jx6BEgBO5otefC03',
  corporate_monthly: 'https://buy.stripe.com/3cIaEZ3JxbVYcly18defC04',
};

for (const [sku, url] of Object.entries(links)) {
  assert.ok(config.includes(url), `api/config.js is missing live payment link for ${sku}`);
}
assert.ok(config.includes('paymentLinks'), 'api/config.js must expose paymentLinks');
assert.ok(config.includes('stripeConfigured: true'), 'Hosted payment links should mark Stripe configured without a Vercel secret key');

assert.ok(app3.includes('client_reference_id'), 'Checkout must attach the Root Lounge user id as client_reference_id');
assert.ok(app3.includes('state.config.paymentLinks'), 'Checkout must use configured hosted payment links');
assert.ok(!app3.includes("fetch('/api/create-checkout-session'"), 'Frontend must not depend on the Vercel Stripe secret endpoint');
assert.ok(!/Uptime Lounge|UPTIME LOUNGE/.test(app3), 'app3.js still contains stale Uptime Lounge branding');
assert.ok(!/Uptime Lounge|UPTIME LOUNGE/.test(gui), 'gui.js still contains stale Uptime Lounge branding');

assert.ok(schema.includes('corporate_entitlements'), 'Supabase schema must persist corporate subscription entitlements');
assert.ok(schema.includes('subscription_id text'), 'Corporate entitlements must key off Stripe subscription id');
assert.ok(schema.includes('organization_id uuid'), 'Corporate entitlements must bind access to an organization');

assert.ok(webhook, 'Supabase Stripe webhook function is missing');
assert.ok(webhook.includes('stripe-signature'), 'Webhook must verify Stripe signatures');
assert.ok(webhook.includes('checkout.session.completed'), 'Webhook must handle completed Checkout sessions');
assert.ok(webhook.includes('customer.subscription.deleted'), 'Webhook must revoke corporate access on subscription cancellation');
assert.ok(!/whsec_[A-Za-z0-9]+/.test(webhook), 'Webhook signing secret must not be hard-coded in source');

console.log('ROOT LOUNGE LIVE BILLING CONTRACT: PASS');
