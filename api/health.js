const PUBLIC_SUPABASE_URL = 'https://hcfixfhgmjnxbmkrhmhx.supabase.co';
const PUBLIC_SUPABASE_KEY = 'sb_publishable_fWODBDxboW2FfehqEei_hg_fSo3EIe9';
const WEBHOOK_URL = 'https://hcfixfhgmjnxbmkrhmhx.supabase.co/functions/v1/root-lounge-stripe-webhook';
const PAYMENT_LINKS = Object.freeze({
  caffeine: 'https://donate.stripe.com/4gM8wR2Ftf8agBO5otefC00',
  oom_tee: 'https://buy.stripe.com/8x28wRfsf0dgfxK049efC01',
  hoodie: 'https://buy.stripe.com/14AbJ3fsf1hk2KY049efC02',
  cap: 'https://buy.stripe.com/8x214p3Jx6BEgBO5otefC03',
  corporate_monthly: 'https://buy.stripe.com/3cIaEZ3JxbVYcly18defC04',
});
const CORE_PAYMENT_LINKS = Object.freeze({
  caffeine: PAYMENT_LINKS.caffeine,
  corporate_monthly: PAYMENT_LINKS.corporate_monthly,
});

const looksLikePaymentLink = value => /^https:\/\/(?:buy|donate)\.stripe\.com\/[A-Za-z0-9]+$/.test(String(value || ''));

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const paymentLinksReady = Object.values(CORE_PAYMENT_LINKS).every(looksLikePaymentLink);
  const webhookConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/[a-z0-9-]+$/i.test(WEBHOOK_URL);
  const deepChecked = req.query?.deep === '1';
  let supabaseReachable = null;
  let stripeReachable = null;
  let webhookReachable = null;

  if (deepChecked) {
    try {
      const response = await fetch(`${PUBLIC_SUPABASE_URL}/rest/v1/`, {
        headers: { apikey: PUBLIC_SUPABASE_KEY, Authorization: `Bearer ${PUBLIC_SUPABASE_KEY}` },
      });
      supabaseReachable = response.ok;
    } catch {
      supabaseReachable = false;
    }

    try {
      const results = await Promise.all(Object.values(CORE_PAYMENT_LINKS).map(url => fetch(url, { redirect: 'manual' })));
      stripeReachable = results.every(response => response.status >= 200 && response.status < 500);
    } catch {
      stripeReachable = false;
    }

    try {
      const response = await fetch(WEBHOOK_URL, { method: 'GET' });
      webhookReachable = response.status === 405 || response.ok;
    } catch {
      webhookReachable = false;
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true,
    version: '3.4.0-live-billing',
    supabaseConfigured: true,
    stripeConfigured: paymentLinksReady,
    webhookConfigured,
    corporateProvisioningConfigured: webhookConfigured,
    paymentReady: paymentLinksReady && webhookConfigured,
    billingMode: 'hosted_payment_links',
    merchFulfillmentReady: false,
    deepChecked,
    supabaseReachable,
    stripeReachable,
    webhookReachable,
    diagnostics: {
      corePaymentLinks: Object.fromEntries(Object.entries(CORE_PAYMENT_LINKS).map(([sku, url]) => [sku, { configured: looksLikePaymentLink(url) }])),
      merchCheckout: { enabled: false, reason: 'fulfillment_not_connected' },
      webhook: { configured: webhookConfigured },
    },
  });
}
