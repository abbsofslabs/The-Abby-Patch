function getPriceIdForMode(mode) {
  if (mode === 'subscription') {
    return process.env.REACT_APP_STRIPE_SUB;
  }
  if (mode === 'payment') {
    return process.env.REACT_APP_STRIPE_SINGLE;
  }
  return undefined;
}

function getCheckoutApiBase() {
  const configured = process.env.REACT_APP_CHECKOUT_API_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return '';
}

async function readErrorMessage(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    const data = JSON.parse(text);
    return data.message || data.error || null;
  } catch {
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      return null;
    }
    return text.slice(0, 240);
  }
}

export async function startStripeCheckout({ mode, email }) {
  if (mode !== 'payment' && mode !== 'subscription') {
    throw new Error('Invalid checkout mode.');
  }

  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const successUrl = `${origin}${pathname}?checkout=success&type=${mode}`;
  const cancelUrl = `${origin}${pathname}?checkout=cancelled`;
  const priceId = getPriceIdForMode(mode);
  const apiBase = getCheckoutApiBase();

  let response;
  try {
    response = await fetch(`${apiBase}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        email,
        successUrl,
        cancelUrl,
        ...(priceId ? { priceId } : {}),
      }),
    });
  } catch {
    throw new Error(
      'Could not reach the checkout server. Stop any running dev servers, then run "npm run dev" (starts both the app and Stripe server).'
    );
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);

    if (response.status === 404) {
      throw new Error(
        'Checkout API was not found. Run "npm run dev" locally, or set REACT_APP_CHECKOUT_API_URL for production.'
      );
    }

    if (message?.includes('Missing required checkout fields')) {
      throw new Error(
        'Checkout server is out of date. Stop all terminals, then restart with "npm run dev".'
      );
    }

    if (message?.includes('not configured')) {
      throw new Error(
        'Stripe is not configured on the server. Check .env.local for STRIPE_SECRET_KEY and STRIPE_PRICE_SINGLE / STRIPE_PRICE_SUB, then restart with npm run dev.'
      );
    }

    throw new Error(
      message ||
        `Checkout failed (HTTP ${response.status}). Run "npm run dev" and confirm the Stripe server is running on port 4242.`
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Checkout server returned an invalid response. Restart with "npm run dev".');
  }

  const { url } = data;
  if (!url) {
    throw new Error('Checkout session URL was not returned.');
  }

  window.location.assign(url);
}
