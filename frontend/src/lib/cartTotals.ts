/** Client-side mirror of the backend cart-money rules (config.py). The server
 * always recomputes the authoritative total at checkout; this is for display. */
export const SHIPPING_FLAT = 4.99;
export const FREE_SHIPPING_OVER = 60;
export const TAX_RATE = 0;

export function shippingFor(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT;
}

export interface Totals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
}

export function computeTotals(subtotal: number, discount = 0): Totals {
  const d = Math.min(Math.max(discount, 0), subtotal);
  const taxable = subtotal - d;
  const tax = +(taxable * TAX_RATE).toFixed(2);
  const shipping = shippingFor(subtotal);
  const total = +(taxable + shipping + tax).toFixed(2);
  return { subtotal: +subtotal.toFixed(2), discount: d, shipping, tax, total };
}
