const isPlaceholder = (value = '') => {
  const v = String(value || '').trim();
  return !v || /^(paste_|your_|replace_|changeme|placeholder)/i.test(v);
};

const PUBLIC_SUPABASE_URL = 'https://hcfixfhgmjnxbmkrhmhx.supabase.co';
const PUBLIC_SUPABASE_KEY = 'sb_publishable_fWODBDxboW2FfehqEei_hg_fSo3EIe9';

const diagnostics = () => {
  const stripeSecret = String(process.env.STRIPE_SECRET_KEY || '').trim();
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const prices = Object.fromEntries([
    'STRIPE_PRICE_CAFFEINE',
    'STRIPE_PRICE_OOM_TEE',
    'STRIPE_PRICE_HOODIE',
    'STRIPE_PRICE_CAP',
    'STRIPE_PRICE_CORPORATE_MONTHLY',
  ].map(name => {
    const value = String(process.env[name] || '').trim();
    return [name, {
      present: Boolean(value),
      placeholder: isPlaceholder(value),
      formatValid: /^price_[A-Za-z0-9]+$/.test(value),
    }];
  }));

  return {
    stripeSecret: {
      present: Boolean(stripeSecret),
      placeholder: isPlaceholder(stripeSecret),
      formatValid: /^(sk_test_|sk_live_)[A-Za-z0-9_]+$/.test(stripeSecret) && !isPlaceholder(stripeSecret),
    },
    prices,
    webhookSecret: {
      present: Boolean(webhookSecret),
      placeholder: isPlaceholder(webhookSecret),
      formatValid: /^whsec_[A-Za-z0-9]+$/.test(webhookSecret) && !isPlaceholder(webhookSecret),
    },
    serviceRole: {
      present: Boolean(serviceRole),
      placeholder: isPlaceholder(serviceRole),
      lengthValid: serviceRole.length >= 30 && !isPlaceholder(serviceRole),
    },
  };
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const d = diagnostics();
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || PUBLIC_SUPABASE_URL).trim();
  const supabaseKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || PUBLIC_SUPABASE_KEY).trim();
  const supabaseConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl)
    && /^(sb_publishable_|eyJ)/.test(supabaseKey) && !isPlaceholder(supabaseKey);
  const supabaseAdminConfigured = d.serviceRole.present && !d.serviceRole.placeholder && d.serviceRole.lengthValid;
  const pricesReady = Object.values(d.prices).every(p => p.present && !p.placeholder && p.formatValid);
  const stripeConfigured = d.stripeSecret.present && !d.stripeSecret.placeholder && d.stripeSecret.formatValid && pricesReady;
  const webhookConfigured = d.webhookSecret.present && !d.webhookSecret.placeholder && d.webhookSecret.formatValid;

  let stripeReachable = null;
  const deepChecked = req.query?.deep === '1';
  if (deepChecked && stripeConfigured) {
    try {
      const response = await fetch('https://api.stripe.com/v1/account', {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      });
      stripeReachable = response.ok;
    } catch {
      stripeReachable = false;
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true,
    version: '3.3.0-recovered',
    supabaseConfigured,
    supabaseAdminConfigured,
    stripeConfigured,
    webhookConfigured,
    paymentReady: stripeConfigured && webhookConfigured,
    deepChecked,
    stripeReachable,
    diagnostics: d,
  });
}
