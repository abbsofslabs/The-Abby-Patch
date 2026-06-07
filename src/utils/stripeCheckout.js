export async function startStripeCheckout({ priceId, mode, email }) {
  const publishableKey = process.env.REACT_APP_STRIPE_KEY;
  if (!publishableKey) {
    throw new Error(
      'Stripe publishable key is missing. Add REACT_APP_STRIPE_KEY to .env.local, then restart npm start.'
    );
  }

  if (!priceId) {
    throw new Error(
      'Stripe price ID is missing. Add REACT_APP_STRIPE_SINGLE and REACT_APP_STRIPE_SUB to .env.local, then restart npm start.'
    );
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
        priceId,
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
        'Stripe server is not configured. Run "npm run server" and confirm STRIPE_SECRET_KEY is in .env.local.'
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
