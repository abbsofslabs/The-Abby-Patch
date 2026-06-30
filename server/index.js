const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const { router: checkoutRouter, getCheckoutConfigStatus } = require('./routes/checkout');

const app = express();
const port = Number(
  process.env.PORT || process.env.CHECKOUT_SERVER_PORT || process.env.STRIPE_PORT || 4242
);

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('Warning: STRIPE_SECRET_KEY is not set. Checkout will fail until configured.');
}

const checkoutStatus = getCheckoutConfigStatus();
if (!checkoutStatus.singlePriceId || !checkoutStatus.subscriptionPriceId) {
  console.warn(
    'Warning: Stripe price IDs missing. Set STRIPE_PRICE_SINGLE and STRIPE_PRICE_SUB in .env.local.'
  );
}

app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  })
);
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'abby-patch-api',
    checkout: getCheckoutConfigStatus(),
  });
});

app.use('/api', checkoutRouter);

app.listen(port, '0.0.0.0', () => {
  console.log(`Abby Patch API listening on port ${port}`);
  const ready = getCheckoutConfigStatus();
  console.log(
    `Checkout ready: secret=${ready.stripeSecretKey}, single=${ready.singlePriceId}, subscription=${ready.subscriptionPriceId}`
  );
});
