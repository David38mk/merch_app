import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, CreditCard, Loader2, ShoppingBag, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { getAddresses, type Address } from "../../api/account";
import { checkout, type CheckoutResult } from "../../api/orders";
import { useAuth } from "../../auth";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { apiError } from "../../lib/apiError";
import type { StorefrontProduct } from "./StorefrontView";

/** Buy-now dialog: variant + quantity + shipping form → stub payment (seam #3).
 * Swapping the stub for Stripe later only changes what the Pay button calls. */
export function BuyNowModal({
  slug,
  product,
  initialColor,
  initialSize,
  initialQuantity,
  onClose,
}: {
  slug: string;
  product: StorefrontProduct;
  /** Preselected variant/quantity — used when Buy Now is clicked from the PDP. */
  initialColor?: string;
  initialSize?: string;
  initialQuantity?: number;
  onClose: () => void;
}) {
  const variants = product.variants ?? [];
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color))], [variants]);
  const [color, setColor] = useState(initialColor ?? colors[0] ?? "");
  const sizes = useMemo(
    () => variants.filter((v) => v.color === color).map((v) => v.size),
    [variants, color],
  );
  const { user } = useAuth();
  const [size, setSize] = useState(initialSize ?? "");
  const [quantity, setQuantity] = useState(initialQuantity ?? 1);
  // A logged-in buyer's details are pre-filled (their order attaches to their
  // account server-side regardless, but this saves them the typing).
  const [name, setName] = useState(user?.display_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CheckoutResult | null>(null);

  // Saved addresses — a logged-in buyer can ship to one they've stored, and their
  // default shipping address pre-fills the form.
  const { data: saved } = useQuery({
    queryKey: ["addresses"],
    queryFn: getAddresses,
    enabled: !!user,
  });
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

  const chosenSize = sizes.includes(size) ? size : sizes.length === 1 ? sizes[0] : "";
  const total = (Number(product.price) * quantity).toFixed(2);
  const valid =
    color && chosenSize && name.trim() && email.trim() && address.trim() && city.trim() &&
    postal.trim() && country.trim();

  const pay = useMutation({
    mutationFn: () =>
      checkout(slug, {
        shop_item_id: product.id,
        color,
        size: chosenSize,
        quantity,
        name: name.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        postal: postal.trim(),
        country: country.trim(),
      }),
    onSuccess: setDone,
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
              Order <span className="font-mono font-medium text-slate-700">#{done.short_id}</span> ·
              €{done.total} paid (test payment). A confirmation was sent to {email.trim()}.
            </p>
            {user ? (
              <Link to="/orders" className="mt-6 block">
                <Button className="w-full">
                  <ShoppingBag className="h-4 w-4" /> Track this order
                </Button>
              </Link>
            ) : (
              <div className="mt-6 space-y-2">
                {/* Nudge the guest to claim their account — signing up with this
                    same email adopts the order they just placed. */}
                <Link to={`/signup?next=${encodeURIComponent(`/store/${slug}`)}`} className="block">
                  <Button className="w-full">
                    <UserPlus className="h-4 w-4" /> Create an account to track it
                  </Button>
                </Link>
                <p className="text-xs text-slate-400">Sign up with {email.trim()} to keep this order in your history.</p>
              </div>
            )}
            <Button variant="ghost" className="mt-2 w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">{product.name}</h2>
                <p className="text-sm text-slate-500">€{product.price} each</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="label">Colour</label>
                <select
                  className="input"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value);
                    setSize("");
                  }}
                >
                  {colors.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Size</label>
                <select className="input" value={chosenSize} onChange={(e) => setSize(e.target.value)}>
                  <option value="" disabled>
                    Pick a size
                  </option>
                  {sizes.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="label">Quantity</label>
              <input
                type="number"
                min={1}
                max={50}
                className="input max-w-24"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              />
            </div>

            <h3 className="mt-5 text-sm font-semibold text-slate-900">Shipping</h3>
            {shipping.length > 0 && (
              <div className="mt-2">
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
            <div className="mt-2 space-y-3">
              <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="input" placeholder="Street address" value={address} onChange={(e) => setAddress(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                <input className="input" placeholder="Postal code" value={postal} onChange={(e) => setPostal(e.target.value)} />
              </div>
              <input className="input" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <Button className="mt-5 w-full" onClick={() => pay.mutate()} disabled={!valid || pay.isPending}>
              {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Pay €{total} (test payment)
            </Button>
            <p className="mt-2 text-center text-xs text-slate-400">
              No real charge — payments are stubbed in this preview build.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
