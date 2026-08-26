const isPlaceholder = (value = '') => {
  const v = String(value || '').trim();
  return !v || /^(paste_|your_|replace_|changeme|placeholder)/i.test(v);
};

const looksLikeSupabaseUrl = (value = '') => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(value || '').trim());
const looksLikePublishableKey = (value = '') => /^(sb_publishable_|eyJ)/.test(String(value || '').trim());
const looksLikeStripeSecret = (value = '') => /^(sk_test_|sk_live_)/.test(String(value || '').trim()) && !isPlaceholder(value);

// Public browser-client identifiers for the production Root Lounge project.
// Keep these pinned so stale hosting environment variables cannot silently
// route production users to a retired Supabase project.
const PUBLIC_SUPABASE_URL = 'https://hcfixfhgmjnxbmkrhmhx.supabase.co';
const PUBLIC_SUPABASE_KEY = 'sb_publishable_fWODBDxboW2FfehqEei_hg_fSo3EIe9';

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
    supabaseUrl: looksLikeSupabaseUrl(supabaseUrl) ? supabaseUrl.replace(/\/$/, '') : '',
    supabaseKey: looksLikePublishableKey(supabaseKey) && !isPlaceholder(supabaseKey) ? supabaseKey : '',
    corporateOrgId: /^[0-9a-f-]{36}$/i.test(corporateOrgId) ? corporateOrgId : '',
    stripeConfigured: looksLikeStripeSecret(process.env.STRIPE_SECRET_KEY),
  });
}
