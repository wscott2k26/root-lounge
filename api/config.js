const isPlaceholder = (value = '') => {
  const v = String(value || '').trim();
  return !v || /^(paste_|your_|replace_|changeme|placeholder)/i.test(v);
};

const looksLikeSupabaseUrl = (value = '') => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(value || '').trim());
const looksLikePublishableKey = (value = '') => /^(sb_publishable_|eyJ)/.test(String(value || '').trim());

// Public browser-client identifiers for the production Uptime Lounge project.
// Stable infrastructure ids intentionally remain unchanged underneath the public rebrand.
const PUBLIC_SUPABASE_URL = 'https://hcfixfhgmjnxbmkrhmhx.supabase.co';
const PUBLIC_SUPABASE_KEY = 'sb_publishable_fWODBDxboW2FfehqEei_hg_fSo3EIe9';
const MERCH_STORE_URL = 'https://uptime-lounge-shop.fourthwall.com';

const paymentLinks = Object.freeze({
  caffeine: 'https://donate.stripe.com/4gM8wR2Ftf8agBO5otefC00',
  corporate_monthly: 'https://buy.stripe.com/3cIaEZ3JxbVYcly18defC04',
});

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const supabaseUrl = PUBLIC_SUPABASE_URL;
  const supabaseKey = PUBLIC_SUPABASE_KEY;
  const corporateOrgId = process.env.VITE_CORPORATE_ORG_ID || '';

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    brandName: 'Uptime Lounge',
    supabaseUrl: looksLikeSupabaseUrl(supabaseUrl) ? supabaseUrl.replace(/\/$/, '') : '',
    supabaseKey: looksLikePublishableKey(supabaseKey) && !isPlaceholder(supabaseKey) ? supabaseKey : '',
    corporateOrgId: /^[0-9a-f-]{36}$/i.test(corporateOrgId) ? corporateOrgId : '',
    stripeConfigured: true,
    billingMode: 'hosted_payment_links',
    paymentLinks,
    merchProvider: 'fourthwall',
    merchProviderConfigured: true,
    merchFulfillmentReady: true,
    merchCatalogStatus: 'live',
    merchCheckoutEnabled: true,
    merchStoreUrl: MERCH_STORE_URL,
  });
}
