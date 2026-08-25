const isPlaceholder = (value = '') => {
  const v = String(value || '').trim();
  return !v || /^(paste_|your_|replace_|changeme|placeholder)/i.test(v);
};

const looksLikeSupabaseUrl = (value = '') => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(value || '').trim());
const looksLikePublishableKey = (value = '') => /^(sb_publishable_|eyJ)/.test(String(value || '').trim());
const looksLikeStripeSecret = (value = '') => /^(sk_test_|sk_live_)/.test(String(value || '').trim()) && !isPlaceholder(value);

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
  const corporateOrgId = process.env.VITE_CORPORATE_ORG_ID || '';

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    supabaseUrl: looksLikeSupabaseUrl(supabaseUrl) ? supabaseUrl.replace(/\/$/, '') : '',
    supabaseKey: looksLikePublishableKey(supabaseKey) && !isPlaceholder(supabaseKey) ? supabaseKey : '',
    corporateOrgId: /^[0-9a-f-]{36}$/i.test(corporateOrgId) ? corporateOrgId : '',
    stripeConfigured: looksLikeStripeSecret(process.env.STRIPE_SECRET_KEY),
  });
}
