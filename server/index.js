require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();
const port = process.env.PORT || 4242;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('Warning: STRIPE_SECRET_KEY is not set. Checkout will fail until configured.');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

app.use(cors());
app.use(express.json());

app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ message: 'Stripe is not configured on the server.' });
  }

  const { priceId, mode, email, successUrl, cancelUrl } = req.body;

  if (!priceId || !mode || !successUrl || !cancelUrl) {
    return res.status(400).json({ message: 'Missing required checkout fields.' });
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
});
