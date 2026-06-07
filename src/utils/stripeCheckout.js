import { loadStripe } from '@stripe/stripe-js';

export async function startStripeCheckout({ priceId, mode, email }) {
  const publishableKey = process.env.REACT_APP_STRIPE_KEY;
  if (!publishableKey) {
    throw new Error('Stripe publishable key is not configured.');
  }

  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const successUrl = `${origin}${pathname}?checkout=success&type=${mode}`;
  const cancelUrl = `${origin}${pathname}?checkout=cancelled`;

  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      priceId,
      mode,
      email,
      successUrl,
      cancelUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Unable to start checkout.');
  }

  const { url, sessionId } = await response.json();
  if (!url && !sessionId) {
    throw new Error('Checkout session was not returned.');
  }

  const stripe = await loadStripe(publishableKey);
  if (!stripe) {
    throw new Error('Unable to load Stripe.');
  }

  if (sessionId) {
    const { error } = await stripe.redirectToCheckout({ sessionId });
    if (error) {
      throw new Error(error.message || 'Unable to redirect to checkout.');
    }
    return;
  }

  window.location.assign(url);
}
