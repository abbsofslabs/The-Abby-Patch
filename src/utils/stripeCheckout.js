function getPriceIdForMode(mode) {
  if (mode === 'subscription') {
    return process.env.REACT_APP_STRIPE_SUB;
  }
  if (mode === 'payment') {
    return process.env.REACT_APP_STRIPE_SINGLE;
  }
  return undefined;
}

function getCheckoutApiCandidates() {
  const candidates = [];
  const configured = process.env.REACT_APP_CHECKOUT_API_URL?.trim();

  if (configured) {
    candidates.push(configured.replace(/\/$/, ''));
  }

  if (process.env.NODE_ENV === 'development') {
    candidates.push('http://localhost:4242');
    candidates.push(''); // same-origin via setupProxy.js
  } else if (!configured) {
    candidates.push('');
  }

  return [...new Set(candidates)];
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

async function requestCheckoutSession(payload) {
  const candidates = getCheckoutApiCandidates();
  let lastResponse = null;
  let lastNetworkError = null;

  for (const apiBase of candidates) {
    try {
      const response = await fetch(`${apiBase}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.status === 405 && candidates.length > 1) {
        lastResponse = response;
        continue;
      }

      return response;
    } catch (error) {
      lastNetworkError = error;
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastNetworkError || new Error('Could not reach checkout server.');
}

function assertProductionCheckoutConfigured() {
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  const apiUrl = process.env.REACT_APP_CHECKOUT_API_URL?.trim();
  if (!apiUrl) {
    throw new Error(
      'Online checkout is not configured yet. Deploy the Stripe server (see render.yaml), add the URL as GitHub secret REACT_APP_CHECKOUT_API_URL, then redeploy the site.'
    );
  }
}

export async function startStripeCheckout({ mode, email }) {
  if (mode !== 'payment' && mode !== 'subscription') {
    throw new Error('Invalid checkout mode.');
  }

  assertProductionCheckoutConfigured();

  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const successUrl = `${origin}${pathname}?checkout=success&type=${mode}`;
  const cancelUrl = `${origin}${pathname}?checkout=cancelled`;
  const priceId = getPriceIdForMode(mode);

  let response;
  try {
    response = await requestCheckoutSession({
      mode,
      email,
      successUrl,
      cancelUrl,
      ...(priceId ? { priceId } : {}),
    });
  } catch {
    throw new Error(
      'Could not reach the checkout server. Run "npm run dev" (starts the app and Stripe server together).'
    );
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);

    if (response.status === 405) {
      throw new Error(
        process.env.NODE_ENV === 'development'
          ? 'Checkout blocked (HTTP 405). Stop all terminals, run "npm run dev", and try again. The Stripe server must be running on port 4242.'
          : 'Checkout is not available on this hosted site yet. Set REACT_APP_CHECKOUT_API_URL to your deployed Stripe server URL and rebuild.'
      );
    }

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
