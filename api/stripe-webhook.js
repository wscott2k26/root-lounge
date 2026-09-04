export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    error: 'This legacy webhook endpoint has been retired. Root Lounge billing events are handled by the Supabase Stripe webhook.',
  });
}
