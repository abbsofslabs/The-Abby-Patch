export async function startStripeCheckout({ mode, email }) {
  if (mode !== 'payment' && mode !== 'subscription') {
    throw new Error('Invalid checkout mode.');
  }

  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const successUrl = `${origin}${pathname}?checkout=success&type=${mode}`;
  const cancelUrl = `${origin}${pathname}?checkout=cancelled`;

  let response;
  try {
    response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        email,
        successUrl,
        cancelUrl,
      }),
    });
  } catch {
    throw new Error(
      'Could not reach the checkout server. Run "npm run dev" (or "npm run server" in a second terminal).'
    );
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error.message || 'Unable to start checkout.';

    if (message.includes('not configured')) {
      throw new Error(
        'Stripe is not configured on the server. Check .env.local for STRIPE_SECRET_KEY and STRIPE_PRICE_SINGLE / STRIPE_PRICE_SUB, then restart with npm run dev.'
      );
    }

    throw new Error(message);
  }

  const { url } = await response.json();
  if (!url) {
    throw new Error('Checkout session URL was not returned.');
  }

  window.location.assign(url);
}
