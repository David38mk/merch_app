import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, CreditCard, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { getAddresses, type Address } from "../../api/account";
import { checkoutCart, type CheckoutResult } from "../../api/orders";
import { useAuth } from "../../auth";
import type { CartItem } from "../../cart";
import { apiError } from "../../lib/apiError";
import { computeTotals } from "../../lib/cartTotals";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

/** Shipping + stub-payment for one brand's cart lines → a single multi-line order. */
export function CheckoutModal({
  slug,
  brandName,
  items,
  discountCode,
  discountAmount = 0,
  onDone,
  onClose,
}: {
  slug: string;
  brandName: string;
  items: CartItem[];
  discountCode?: string | null;
  discountAmount?: number;
  onDone: (shortId: string) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.display_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CheckoutResult | null>(null);

  const { data: saved } = useQuery({ queryKey: ["addresses"], queryFn: getAddresses, enabled: !!user });
  const shipping = useMemo(() => (saved ?? []).filter((a) => a.address_type === "SHIPPING"), [saved]);

  function applyAddress(a: Address) {
    if (a.full_name) setName(a.full_name);
    setAddress([a.line1, a.line2].filter(Boolean).join(", "));
    setCity(a.city);
    setPostal(a.postal_code);
    setCountry(a.country);
  }
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || shipping.length === 0) return;
    prefilled.current = true;
    applyAddress(shipping.find((a) => a.is_default) ?? shipping[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipping]);

  const subtotal = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  const t = computeTotals(subtotal, discountAmount);
  const total = t.total.toFixed(2);
  const valid = name.trim() && email.trim() && address.trim() && city.trim() && postal.trim() && country.trim();

  const pay = useMutation({
    mutationFn: () =>
      checkoutCart(slug, {
        items: items.map((i) => ({
          shop_item_id: i.shop_item_id,
          color: i.color,
          size: i.size,
          quantity: i.quantity,
        })),
        name: name.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        postal: postal.trim(),
        country: country.trim(),
        discount_code: discountCode ?? null,
      }),
    onSuccess: (r) => setDone(r),
    onError: (e) => setError(apiError(e, "Payment failed — please try again.")),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <Card className="max-h-[90vh] w-full max-w-md overflow-y-auto p-6">
        {done ? (
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-slate-900">Order placed!</h2>
            <p className="mt-2 text-sm text-slate-500">
              Order <span className="font-mono font-medium text-slate-700">#{done.short_id}</span> · €{done.total}{" "}
              paid (test payment). A confirmation was sent to {email.trim()}.
            </p>
            {user ? (
              <Link to="/orders" className="mt-6 block">
                <Button className="w-full">Track your orders</Button>
              </Link>
            ) : (
              <Link to={`/signup?next=/cart`} className="mt-6 block">
                <Button className="w-full">Create an account to track it</Button>
              </Link>
            )}
            <Button variant="ghost" className="mt-2 w-full" onClick={() => onDone(done.short_id)}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Checkout · {brandName}</h2>
                <p className="text-sm text-slate-500">{items.length} line(s) · €{total}</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {shipping.length > 0 && (
              <div className="mt-4">
                <label className="label">Ship to a saved address</label>
                <select
                  className="input"
                  defaultValue=""
                  onChange={(e) => {
                    const a = shipping.find((x) => x.id === e.target.value);
                    if (a) applyAddress(a);
                  }}
                >
                  <option value="">Enter a new address…</option>
                  {shipping.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name} — {a.line1}, {a.city}
                      {a.is_default ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-4 space-y-3">
              <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="input" placeholder="Street address" value={address} onChange={(e) => setAddress(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                <input className="input" placeholder="Postal code" value={postal} onChange={(e) => setPostal(e.target.value)} />
              </div>
              <input className="input" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>

            {/* Summary */}
            <dl className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm">
              <SummaryRow label="Subtotal" value={`€${t.subtotal.toFixed(2)}`} />
              {t.discount > 0 && (
                <SummaryRow label={`Discount${discountCode ? ` (${discountCode})` : ""}`} value={`− €${t.discount.toFixed(2)}`} accent />
              )}
              <SummaryRow label="Shipping" value={t.shipping === 0 ? "Free" : `€${t.shipping.toFixed(2)}`} />
              {t.tax > 0 && <SummaryRow label="Tax" value={`€${t.tax.toFixed(2)}`} />}
              <div className="border-t border-slate-100 pt-1.5">
                <SummaryRow label="Total" value={`€${t.total.toFixed(2)}`} strong />
              </div>
            </dl>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <Button className="mt-5 w-full" onClick={() => pay.mutate()} disabled={!valid || pay.isPending}>
              {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Pay €{total} (test payment)
            </Button>
            <p className="mt-2 text-center text-xs text-slate-400">No real charge — payments are stubbed.</p>
          </>
        )}
      </Card>
    </div>
  );
}

function SummaryRow({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? "font-semibold text-slate-900" : "text-slate-500"}>{label}</dt>
      <dd className={strong ? "font-semibold text-slate-900" : accent ? "text-emerald-600" : "text-slate-700"}>{value}</dd>
    </div>
  );
}
