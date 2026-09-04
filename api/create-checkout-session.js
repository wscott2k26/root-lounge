export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    error: 'This legacy checkout endpoint has been retired. Root Lounge now uses Stripe-hosted Payment Links.',
  });
}
