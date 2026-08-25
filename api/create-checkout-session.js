const PRICE_ENV = {
  caffeine: 'STRIPE_PRICE_CAFFEINE',
  oom_tee: 'STRIPE_PRICE_OOM_TEE',
  hoodie: 'STRIPE_PRICE_HOODIE',
  cap: 'STRIPE_PRICE_CAP',
  corporate_monthly: 'STRIPE_PRICE_CORPORATE_MONTHLY',
};

const isPlaceholder = (value = '') => {
  const v = String(value || '').trim();
  return !v || /^(paste_|your_|replace_|changeme|placeholder)/i.test(v);
};

const parseBody = (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const secret = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!/^(sk_test_|sk_live_)/.test(secret) || isPlaceholder(secret)) {
    return res.status(503).json({ error: 'Checkout is not configured yet.' });
  }

  const body = parseBody(req);
  const sku = String(body.sku || '').trim();
  const envName = PRICE_ENV[sku];
  if (!envName) return res.status(400).json({ error: 'Unknown product.' });

  const price = String(process.env[envName] || '').trim();
  if (!/^price_[A-Za-z0-9]+$/.test(price) || isPlaceholder(price)) {
    return res.status(503).json({ error: 'This checkout item is not configured yet.' });
  }

  const mode = sku === 'corporate_monthly' ? 'subscription' : 'payment';
  const workspaceMode = ['community', 'corporate'].includes(body.mode) ? body.mode : 'community';
  const userId = /^[0-9a-f-]{36}$/i.test(String(body.userId || '')) ? String(body.userId) : '';
  const site = String(process.env.PUBLIC_SITE_URL || 'https://root-lounge.vercel.app').replace(/\/$/, '');

  const params = new URLSearchParams();
  params.set('mode', mode);
  params.set('line_items[0][price]', price);
  params.set('line_items[0][quantity]', '1');
  params.set('success_url', `${site}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${site}/?checkout=cancelled`);
  params.set('metadata[root_lounge_sku]', sku);
  params.set('metadata[workspace_mode]', workspaceMode);
  if (userId) {
    params.set('client_reference_id', userId);
    params.set('metadata[root_lounge_user_id]', userId);
  }
  if (mode === 'payment') params.set('payment_intent_data[metadata][root_lounge_sku]', sku);

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !/^https:\/\/checkout\.stripe\.com\//.test(String(data.url || ''))) {
      console.error('Stripe checkout creation failed', response.status, data?.error?.type || 'unknown');
      return res.status(502).json({ error: 'Stripe Checkout could not be created.' });
    }
    return res.status(200).json({ url: data.url });
  } catch (error) {
    console.error('Stripe checkout request failed', error?.message || error);
    return res.status(502).json({ error: 'Checkout is temporarily unavailable.' });
  }
}
