import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = await readFile('api/config.js', 'utf8');
const health = await readFile('api/health.js', 'utf8');
const legacyCheckout = await readFile('api/create-checkout-session.js', 'utf8');
const legacyWebhook = await readFile('api/stripe-webhook.js', 'utf8');
const app3 = await readFile('recovered-live/app3.js', 'utf8');
const helper = await readFile('recovered-live/helper.js', 'utf8');
const migration = await readFile('supabase/migrations/20260904035000_root_lounge_live_billing.sql', 'utf8');
const enforcement = await readFile('supabase/migrations/20260904043000_root_lounge_entitlement_enforcement.sql', 'utf8');
const rlsPerf = await readFile('supabase/migrations/20260904044000_root_lounge_entitlement_rls_perf.sql', 'utf8');
const webhook = await readFile('supabase/functions/root-lounge-stripe-webhook/index.ts', 'utf8');

const stripeLinks = {
  caffeine: 'https://donate.stripe.com/4gM8wR2Ftf8agBO5otefC00',
  corporate_monthly: 'https://buy.stripe.com/3cIaEZ3JxbVYcly18defC04',
};
const retiredPhysicalLinks = [
  'https://buy.stripe.com/8x28wRfsf0dgfxK049efC01',
  'https://buy.stripe.com/14AbJ3fsf1hk2KY049efC02',
  'https://buy.stripe.com/8x214p3Jx6BEgBO5otefC03',
];

for (const [sku, url] of Object.entries(stripeLinks)) {
  assert.ok(config.includes(url), `api/config.js is missing live Stripe link for ${sku}`);
  assert.ok(health.includes(url), `api/health.js is missing live Stripe health check for ${sku}`);
}
for (const url of retiredPhysicalLinks) {
  assert.ok(!config.includes(url), 'Physical merchandise must not be exposed through Stripe config');
  assert.ok(!health.includes(url), 'Physical merchandise must not participate in Stripe health checks');
}
assert.ok(config.includes('paymentLinks'), 'api/config.js must expose hosted paymentLinks');
assert.ok(config.includes('stripeConfigured: true'), 'Hosted payment links must mark Stripe configured');
assert.ok(config.includes("merchProvider: 'fourthwall'"), 'Physical merchandise must be routed to Fourthwall');
assert.ok(config.includes('merchCheckoutEnabled: false'), 'Merch checkout must remain closed until a real Fourthwall offer exists');
assert.ok(health.includes("billingMode: 'hosted_payment_links'"), 'Health must report hosted Stripe billing mode');
assert.ok(health.includes('webhookConfigured'), 'Health must report webhook readiness');
assert.ok(health.includes('merchFulfillmentReady: merchProviderConfigured'), 'Health must distinguish fulfillment-provider readiness from catalog readiness');

for (const [name, source] of [['create-checkout-session.js', legacyCheckout], ['stripe-webhook.js', legacyWebhook]]) {
  assert.ok(source.includes('status(410)'), `${name} must be retired with HTTP 410`);
  assert.ok(!source.includes('STRIPE_SECRET_KEY'), `${name} must not depend on a legacy Stripe secret`);
  assert.ok(!source.includes('STRIPE_WEBHOOK_SECRET'), `${name} must not depend on a legacy webhook secret`);
}

assert.ok(app3.includes('client_reference_id'), 'Corporate checkout must attach the user id as client_reference_id');
assert.ok(app3.includes('state.config.paymentLinks'), 'Corporate/support checkout must use configured hosted payment links');
assert.ok(app3.includes('corporate_entitlements'), 'Client must resolve active corporate entitlement from Supabase');
assert.ok(!app3.includes("fetch('/api/create-checkout-session'"), 'Frontend must not depend on the retired Vercel checkout endpoint');
assert.ok(helper.includes('Merch collection opening soon'), 'Runtime must replace legacy physical Stripe cards with Fourthwall catalog state');

assert.ok(migration.includes('corporate_entitlements'), 'Billing migration must persist corporate subscription entitlements');
assert.ok(migration.includes('subscription_id text'), 'Corporate entitlements must key off Stripe subscription id');
assert.ok(migration.includes('organization_id uuid'), 'Corporate entitlements must bind access to an organization');
assert.ok(migration.includes('server_secrets'), 'Webhook signing material must have a server-only storage table');
assert.ok(migration.includes('enable row level security'), 'Billing tables must use RLS');
assert.ok(enforcement.includes("if p_status = 'active'"), 'Active billing status must restore organization membership');
assert.ok(enforcement.includes('delete from public.organization_members'), 'Non-active billing status must revoke organization membership');
assert.ok(enforcement.includes("role = 'owner'"), 'Reactivated corporate subscriptions must restore owner role');
assert.ok(rlsPerf.includes('(select auth.uid())'), 'Corporate entitlement RLS should cache auth.uid() per query');
assert.ok(webhook.includes('stripe-signature'), 'Webhook must verify Stripe signatures');
assert.ok(webhook.includes('checkout.session.completed'), 'Webhook must handle completed Checkout sessions');
assert.ok(webhook.includes('customer.subscription.deleted'), 'Webhook must revoke corporate access on subscription cancellation');
assert.ok(webhook.includes('invoice.payment_failed'), 'Webhook must react to failed recurring payments');
assert.ok(!/whsec_[A-Za-z0-9]+/.test(webhook), 'Webhook signing secret must not be hard-coded in source');

console.log('UPTIME LOUNGE LIVE BILLING CONTRACT: PASS');
