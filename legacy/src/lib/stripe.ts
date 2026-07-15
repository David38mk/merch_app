// Stripe integration is stubbed — payments are not yet active.
// This file is kept so imports don't break when payments are re-enabled.

export const STRIPE_PLANS = {
  CREATOR: { name: "Creator", amount: 1900, currency: "eur" },
  PRO: { name: "Pro", amount: 4900, currency: "eur" },
} as const;
