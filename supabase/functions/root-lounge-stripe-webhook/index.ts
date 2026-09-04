const encoder = new TextEncoder();
const SUPABASE_URL = String(Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
const SERVICE_ROLE = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function stringId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id?: unknown }).id === 'string') {
    return String((value as { id: string }).id);
  }
  return null;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function rest(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || SERVICE_ROLE.length < 30) throw new Error('Supabase server credentials unavailable');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE,
      authorization: `Bearer ${SERVICE_ROLE}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase REST ${response.status}: ${detail.slice(0, 240)}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function rpc(name: string, payload: Record<string, unknown>) {
  return rest(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) });
}

async function loadWebhookSecret(): Promise<string> {
  const rows = await rest('server_secrets?name=eq.stripe_webhook_signing&select=value&limit=1');
  return Array.isArray(rows) && typeof rows[0]?.value === 'string' ? rows[0].value : '';
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeHexEqual(a: string, b: string): boolean {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSeconds = 300) {
  if (!header || !secret.startsWith('whsec_')) return false;
  const parts = header.split(',').map(v => v.trim());
  const timestampPart = parts.find(v => v.startsWith('t='));
  const signatures = parts.filter(v => v.startsWith('v1=')).map(v => v.slice(3));
  if (!timestampPart || !signatures.length) return false;
  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`));
  const expected = hex(new Uint8Array(digest));
  return signatures.some(signature => constantTimeHexEqual(signature, expected));
}

function subscriptionIdFrom(object: Record<string, any>): string | null {
  return stringId(object.subscription)
    || stringId(object.parent?.subscription_details?.subscription)
    || (object.object === 'subscription' ? stringId(object.id) : null);
}

async function processEvent(event: Record<string, any>) {
  const type = String(event.type || '');
  const object = (event.data?.object || {}) as Record<string, any>;
  const metadata = (object.metadata || {}) as Record<string, any>;

  if (type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded') {
    if (String(metadata.root_lounge_sku || '') === 'corporate_monthly') {
      const userId = String(object.client_reference_id || metadata.root_lounge_user_id || '');
      const subscriptionId = subscriptionIdFrom(object);
      if (!isUuid(userId) || !subscriptionId) throw new Error('Corporate checkout is missing a valid Root Lounge user or subscription id');
      await rpc('provision_corporate_entitlement', {
        p_subscription_id: subscriptionId,
        p_session_id: stringId(object.id),
        p_user_id: userId,
        p_customer_id: stringId(object.customer),
      });
    }
  } else if (type === 'customer.subscription.deleted') {
    const subscriptionId = subscriptionIdFrom(object);
    if (subscriptionId) await rpc('revoke_corporate_entitlement', { p_subscription_id: subscriptionId });
  } else if (type === 'customer.subscription.updated') {
    const subscriptionId = subscriptionIdFrom(object);
    const status = String(object.status || '');
    if (subscriptionId && status === 'canceled') {
      await rpc('revoke_corporate_entitlement', { p_subscription_id: subscriptionId });
    } else if (subscriptionId && ['active', 'past_due', 'unpaid', 'incomplete'].includes(status)) {
      await rpc('set_corporate_entitlement_status', { p_subscription_id: subscriptionId, p_status: status });
    }
  } else if (type === 'invoice.payment_failed') {
    const subscriptionId = subscriptionIdFrom(object);
    if (subscriptionId) await rpc('set_corporate_entitlement_status', { p_subscription_id: subscriptionId, p_status: 'past_due' });
  } else if (type === 'invoice.paid') {
    const subscriptionId = subscriptionIdFrom(object);
    if (subscriptionId) await rpc('set_corporate_entitlement_status', { p_subscription_id: subscriptionId, p_status: 'active' });
  }

  const row = {
    stripe_event_id: String(event.id || ''),
    stripe_session_id: String(object.object || '') === 'checkout.session' ? stringId(object.id) : null,
    event_type: type,
    payment_status: object.payment_status || object.status || null,
    customer_id: stringId(object.customer),
    subscription_id: subscriptionIdFrom(object),
    root_lounge_user_id: metadata.root_lounge_user_id || object.client_reference_id || null,
    sku: metadata.root_lounge_sku || null,
    workspace_mode: metadata.workspace_mode || null,
    amount_total: Number.isFinite(object.amount_total) ? object.amount_total : null,
    currency: object.currency || null,
    raw_metadata: metadata,
  };

  await rest('payment_events?on_conflict=stripe_event_id', {
    method: 'POST',
    headers: { prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const rawBody = await req.text();
    const secret = await loadWebhookSecret();
    if (!secret) return json(503, { error: 'Webhook secret is not configured' });
    if (!await verifyStripeSignature(rawBody, req.headers.get('stripe-signature'), secret)) {
      return json(400, { error: 'Invalid Stripe signature' });
    }

    let event: Record<string, any>;
    try { event = JSON.parse(rawBody); }
    catch { return json(400, { error: 'Invalid event payload' }); }

    const accepted = new Set([
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.paid',
      'invoice.payment_failed',
    ]);
    if (!accepted.has(String(event.type || ''))) return json(200, { received: true, ignored: true });

    await processEvent(event);
    return json(200, { received: true });
  } catch (error) {
    console.error('Root Lounge Stripe webhook failure', error instanceof Error ? error.message : String(error));
    return json(500, { error: 'Webhook processing failed' });
  }
});
