const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();
const port = process.env.PORT || 4242;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

function getPriceIdForMode(mode) {
  if (mode === 'subscription') {
    return process.env.STRIPE_PRICE_SUB || process.env.REACT_APP_STRIPE_SUB;
  }
  if (mode === 'payment') {
    return process.env.STRIPE_PRICE_SINGLE || process.env.REACT_APP_STRIPE_SINGLE;
  }
  return null;
}

function getCheckoutConfigStatus() {
  return {
    stripeSecretKey: Boolean(stripeSecretKey),
    singlePriceId: Boolean(getPriceIdForMode('payment')),
    subscriptionPriceId: Boolean(getPriceIdForMode('subscription')),
  };
}

if (!stripeSecretKey) {
  console.warn('Warning: STRIPE_SECRET_KEY is not set. Checkout will fail until configured.');
}

const status = getCheckoutConfigStatus();
if (!status.singlePriceId || !status.subscriptionPriceId) {
  console.warn(
    'Warning: Stripe price IDs missing. Set STRIPE_PRICE_SINGLE and STRIPE_PRICE_SUB in .env.local (or REACT_APP_STRIPE_SINGLE / REACT_APP_STRIPE_SUB).'
  );
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

app.use(cors());
app.use(express.json());

app.get('/api/checkout-status', (_req, res) => {
  res.json(getCheckoutConfigStatus());
});

app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({
      message:
        'Stripe is not configured on the server. Add STRIPE_SECRET_KEY to .env.local and run npm run server.',
    });
  }

  const { priceId: requestedPriceId, mode, email, successUrl, cancelUrl } = req.body;
  const priceId = requestedPriceId || getPriceIdForMode(mode);

  if (!priceId || !mode || !successUrl || !cancelUrl) {
    const missingPrice = !priceId ? 'price ID' : null;
    const missingMode = !mode ? 'mode' : null;
    const missingUrls = !successUrl || !cancelUrl ? 'redirect URLs' : null;
    const missing = [missingPrice, missingMode, missingUrls].filter(Boolean).join(', ');

    return res.status(400).json({
      message: missingPrice
        ? 'Stripe price ID is not configured on the server. Add STRIPE_PRICE_SINGLE and STRIPE_PRICE_SUB to .env.local, then restart npm run dev.'
        : `Missing required checkout fields: ${missing}.`,
    });
  }

  if (mode !== 'payment' && mode !== 'subscription') {
    return res.status(400).json({ message: 'Invalid checkout mode.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error.message);
    return res.status(500).json({ message: error.message || 'Unable to create checkout session.' });
  }
});

app.listen(port, () => {
  console.log(`Stripe checkout server listening on http://localhost:${port}`);
  const ready = getCheckoutConfigStatus();
  console.log(
    `Checkout ready: secret=${ready.stripeSecretKey}, single=${ready.singlePriceId}, subscription=${ready.subscriptionPriceId}`
  );
});
