// The /payment-settings endpoint returns the merchant's whole gateway config,
// which on some backends still includes SECRET credentials (gateway secret keys,
// salts, webhook secrets). Anything dispatched into Redux ends up in localStorage
// via redux-persist, so it must be readable-by-anyone safe.
//
// Only the fields the browser genuinely needs are kept here — the publishable /
// public keys the gateway SDKs require, the currency codes, and the per-method
// enable flags. Everything else is dropped at ingest and never reaches the store.
//
// NOTE: this limits the blast radius, it does not fix the leak. As long as the
// endpoint returns secrets they are still visible in the Network tab. The real
// fix is server-side: stop sending secret keys to the client.

// Per-gateway enable flags ("1" = merchant enabled this method).
const PAYMENT_METHOD_FLAGS = [
  "razorpay_payment_method",
  "paypal_payment_method",
  "paystack_payment_method",
  "stripe_payment_method",
  "cashfree_payment_method",
  "midtrans_payment_method",
  "phonepay_payment_method",
  "paytabs_payment_method",
];

// Client-safe credentials + display config consumed by the checkout / wallet /
// footer components. All of these are public by design in their gateway's SDK.
const PUBLIC_FIELDS = [
  "razorpay_key", // Razorpay key_id (rzp_live_… / rzp_test_…)
  "stripe_publishable_key", // Stripe pk_live_… / pk_test_…
  "paystack_public_key", // Paystack pk_…
  "paystack_currency_code",
];

const ALLOWED_KEYS = [...PAYMENT_METHOD_FLAGS, ...PUBLIC_FIELDS];

/**
 * Strip the payment-settings payload down to the client-safe fields.
 *
 * @param {object|null|undefined} raw decoded /payment-settings response body
 * @returns {object|null} whitelisted copy, or null when there is nothing to keep
 */
export const sanitizePaymentSetting = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const safe = {};
  for (const key of ALLOWED_KEYS) {
    if (raw[key] !== undefined) safe[key] = raw[key];
  }
  return safe;
};

export { ALLOWED_KEYS as PAYMENT_SETTING_ALLOWED_KEYS };
