// Stripe, called over its REST API (no SDK). Only STRIPE_SECRET_KEY is needed: a payment
// is marked paid only after MotoDoc fetches the Checkout Session from Stripe itself, so
// nothing in an incoming request is trusted on its own.
const flatten = (value, prefix = '', out = []) => {
  if (value === undefined || value === null) return out;
  if (typeof value === 'object')
    for (const [key, inner] of Object.entries(value))
      flatten(inner, prefix ? `${prefix}[${key}]` : key, out);
  else out.push([prefix, String(value)]);
  return out;
};

export function stripeClient(secret = process.env.STRIPE_SECRET_KEY, fetchImpl = globalThis.fetch) {
  if (!secret) return null;
  const call = async (method, path, params) => {
    const response = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
      method,
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: params ? new URLSearchParams(flatten(params)).toString() : undefined,
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Stripe request failed:', response.status, data.error?.code || '');
      throw Object.assign(new Error('Online payment is unavailable right now. Try again soon.'), {
        status: 502,
      });
    }
    return data;
  };
  return {
    mode: secret.startsWith('sk_live_') ? 'live' : 'test',
    createCheckout: (params) => call('POST', 'checkout/sessions', params),
    getCheckout: (id) => call('GET', `checkout/sessions/${encodeURIComponent(id)}`),
  };
}
