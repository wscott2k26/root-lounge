const PUBLIC_SUPABASE_URL = 'https://hcfixfhgmjnxbmkrhmhx.supabase.co';
const PUBLIC_SUPABASE_KEY = 'sb_publishable_fWODBDxboW2FfehqEei_hg_fSo3EIe9';
const WEBHOOK_URL = 'https://hcfixfhgmjnxbmkrhmhx.supabase.co/functions/v1/root-lounge-stripe-webhook';
const MERCH_STORE_URL = 'https://uptime-lounge-shop.fourthwall.com';
const CORE_PAYMENT_LINKS = Object.freeze({
  caffeine: 'https://donate.stripe.com/4gM8wR2Ftf8agBO5otefC00',
  corporate_monthly: 'https://buy.stripe.com/3cIaEZ3JxbVYcly18defC04',
});

const looksLikePaymentLink = value => /^https:\/\/(?:buy|donate)\.stripe\.com\/[A-Za-z0-9]+$/.test(String(value || ''));
const looksLikeFourthwallShop = value => /^https:\/\/[a-z0-9-]+\.fourthwall\.com\/?$/i.test(String(value || '').trim());

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const paymentLinksReady = Object.values(CORE_PAYMENT_LINKS).every(looksLikePaymentLink);
  const webhookConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/[a-z0-9-]+$/i.test(WEBHOOK_URL);
  const merchProviderConfigured = looksLikeFourthwallShop(MERCH_STORE_URL);
  const requestUrl = new URL(req.url || '/api/health', 'https://uptime-lounge.invalid');
  const deepChecked = requestUrl.searchParams.get('deep') === '1';
  let supabaseReachable = null;
  let stripeReachable = null;
  let webhookReachable = null;
  let merchProviderReachable = null;

  if (deepChecked) {
    try {
      const response = await fetch(`${PUBLIC_SUPABASE_URL}/rest/v1/`, {
        headers: { apikey: PUBLIC_SUPABASE_KEY, Authorization: `Bearer ${PUBLIC_SUPABASE_KEY}` },
      });
      supabaseReachable = response.status >= 200 && response.status < 500;
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
      webhookReachable = response.status === 405 || (response.status >= 200 && response.status < 500);
    } catch {
      webhookReachable = false;
    }

    try {
      const response = await fetch(MERCH_STORE_URL, { method: 'GET', redirect: 'manual' });
      merchProviderReachable = response.status >= 200 && response.status < 500;
    } catch {
      merchProviderReachable = false;
    }
  }

  const deepHealthy = !deepChecked || [supabaseReachable, stripeReachable, webhookReachable, merchProviderReachable].every(Boolean);

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: paymentLinksReady && webhookConfigured && merchProviderConfigured && deepHealthy,
    version: '4.0.0-uptime-premium',
    brandName: 'Uptime Lounge',
    supabaseConfigured: true,
    stripeConfigured: paymentLinksReady,
    webhookConfigured,
    corporateProvisioningConfigured: webhookConfigured,
    paymentReady: paymentLinksReady && webhookConfigured,
    billingMode: 'hosted_payment_links',
    merchProvider: 'fourthwall',
    merchProviderConfigured,
    merchFulfillmentReady: merchProviderConfigured,
    merchCatalogStatus: 'awaiting_products',
    merchCheckoutEnabled: false,
    deepChecked,
    supabaseReachable,
    stripeReachable,
    webhookReachable,
    merchProviderReachable,
    diagnostics: {
      corePaymentLinks: Object.fromEntries(Object.entries(CORE_PAYMENT_LINKS).map(([sku, url]) => [sku, { configured: looksLikePaymentLink(url) }])),
      merchCheckout: { enabled: false, reason: 'awaiting_products', storeUrl: MERCH_STORE_URL },
      webhook: { configured: webhookConfigured },
    },
  });
}
