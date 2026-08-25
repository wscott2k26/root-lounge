import { createHmac, timingSafeEqual } from 'node:crypto';

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function verifyStripeSignature(rawBody, header, secret, toleranceSeconds = 300) {
  if (!header || !secret || !secret.startsWith('whsec_')) return false;
  const parts = String(header).split(',').map(v => v.trim());
  const timestampPart = parts.find(v => v.startsWith('t='));
  const signatures = parts.filter(v => v.startsWith('v1=')).map(v => v.slice(3));
  if (!timestampPart || !signatures.length) return false;

  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) return false;

  const signedPayload = Buffer.concat([
    Buffer.from(`${timestamp}.`, 'utf8'),
    rawBody,
  ]);
  const expectedHex = createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expected = Buffer.from(expectedHex, 'hex');

  return signatures.some(signature => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const actual = Buffer.from(signature, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

async function recordPaymentEvent(event) {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl) || serviceRole.length < 30) {
    throw new Error('Supabase server configuration is missing.');
  }

  const session = event?.data?.object || {};
  const metadata = session.metadata || {};
  const row = {
    stripe_event_id: String(event.id || ''),
    stripe_session_id: session.id || null,
    event_type: String(event.type || ''),
    payment_status: session.payment_status || session.status || null,
    customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
    subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null,
    root_lounge_user_id: metadata.root_lounge_user_id || session.client_reference_id || null,
    sku: metadata.root_lounge_sku || null,
    workspace_mode: metadata.workspace_mode || null,
    amount_total: Number.isFinite(session.amount_total) ? session.amount_total : null,
    currency: session.currency || null,
    raw_metadata: metadata,
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/payment_events?on_conflict=stripe_event_id`, {
    method: 'POST',
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase payment event write failed: HTTP ${response.status} ${detail.slice(0, 160)}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!/^whsec_[A-Za-z0-9]+$/.test(secret)) {
    return res.status(503).json({ error: 'Webhook is not configured.' });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch {
    return res.status(400).json({ error: 'Unable to read request body.' });
  }

  const signature = req.headers['stripe-signature'];
  if (!verifyStripeSignature(rawBody, signature, secret)) {
    return res.status(400).json({ error: 'Invalid Stripe signature.' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid event payload.' });
  }

  const accepted = new Set([
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
  ]);
  if (!accepted.has(event.type)) return res.status(200).json({ received: true, ignored: true });

  try {
    await recordPaymentEvent(event);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Root Lounge Stripe webhook persistence failed', error?.message || error);
    return res.status(500).json({ error: 'Verified event could not be recorded.' });
  }
}
