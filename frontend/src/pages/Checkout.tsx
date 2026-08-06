import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCard, Loader2, Lock, MapPin, ShieldCheck, Truck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";

import { getAddresses, type Address } from "../api/account";
import { getShippingMethods, validateDiscount } from "../api/marketplace";
import { checkoutCart } from "../api/orders";
import { useAuth } from "../auth";
import { DesignPreviewThumb } from "../components/design/DesignPreviewThumb";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useCart } from "../cart";
import { apiError } from "../lib/apiError";
import { cn } from "../lib/cn";

// Luhn check — validates a card number's structure (never sent to our server; a
// real integration tokenises via the gateway's SDK — PCI scope stays off us).
function luhnValid(num: string): boolean {
  const digits = num.replace(/\s+/g, "");
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

// Brand from the card's IIN prefix — a non-sensitive display bit (brand + last4
// are PCI-safe to keep; the full number/CVC never leave the browser).
function cardBrand(num: string): string | null {
  const d = num.replace(/\D/g, "");
  if (/^4/.test(d)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  if (/^6(?:011|5)/.test(d)) return "Discover";
  return d ? "Card" : null;
}

function expiryValid(mmYY: string): boolean {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(mmYY.trim());
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  // Last day of the card's month, compared to now (no Date-arg ban in browser).
  const exp = new Date(year, month, 0, 23, 59, 59);
  return exp.getTime() >= Date.now();
}

export default function Checkout() {
  const { slug = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { byBrand, clearBrand } = useCart();

  const group = byBrand.find((g) => g.slug === slug);
  const discountCode = (location.state as { discountCode?: string } | null)?.discountCode ?? null;

  const idemKey = useRef<string>();
  if (!idemKey.current) idemKey.current = crypto.randomUUID();

  // Contact
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  // Shipping address
  const [fullName, setFullName] = useState(user?.display_name ?? "");
  const [street, setStreet] = useState("");
  const [apartment, setApartment] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("");
  // Shipping method
  const [methodId, setMethodId] = useState("standard");
  // Payment (client-only)
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);

  const subtotal = useMemo(() => (group?.items ?? []).reduce((s, i) => s + Number(i.price) * i.quantity, 0), [group]);

  const { data: methods } = useQuery({
    queryKey: ["shipping-methods", subtotal],
    queryFn: () => getShippingMethods(subtotal),
    enabled: subtotal > 0,
  });
  const { data: discount } = useQuery({
    queryKey: ["discount", slug, discountCode, subtotal],
    queryFn: () => validateDiscount(discountCode!, slug, subtotal),
    enabled: !!discountCode && subtotal > 0,
  });

  // Prefill from the buyer's default shipping address.
  const { data: saved } = useQuery({ queryKey: ["addresses"], queryFn: getAddresses, enabled: !!user });
  const savedShipping = useMemo(() => (saved ?? []).filter((a) => a.address_type === "SHIPPING"), [saved]);
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || savedShipping.length === 0) return;
    prefilled.current = true;
    applyAddress(savedShipping.find((a) => a.is_default) ?? savedShipping[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedShipping]);

  function applyAddress(a: Address) {
    if (a.full_name) setFullName(a.full_name);
    setStreet(a.line1);
    setApartment(a.line2 ?? "");
    setCity(a.city);
    setPostal(a.postal_code);
    setCountry(a.country);
    if (a.phone) setPhone(a.phone);
  }

  const place = useMutation({
    mutationFn: () =>
      checkoutCart(slug, {
        items: (group?.items ?? []).map((i) => ({
          shop_item_id: i.shop_item_id,
          color: i.color,
          size: i.size,
          quantity: i.quantity,
        })),
        name: fullName.trim(),
        email: email.trim(),
        address: street.trim(),
        apartment: apartment.trim() || null,
        phone: phone.trim() || null,
        city: city.trim(),
        postal: postal.trim(),
        country: country.trim(),
        discount_code: discountCode,
        shipping_method: methodId,
        idempotency_key: idemKey.current,
        card_brand: cardBrand(cardNumber),
        card_last4: cardNumber.replace(/\D/g, "").slice(-4) || null,
      }),
    onSuccess: (r) => {
      clearBrand(slug);
      navigate(`/order/confirmed/${r.confirmation_token}`, { replace: true });
    },
    onError: (e) => setError(apiError(e, "Payment failed — please check your details and try again.")),
  });

  // Cart for this brand emptied (e.g. direct nav or after order) → back to cart.
  if (!group) return <Navigate to="/cart" replace />;

  const method = methods?.find((m) => m.id === methodId);
  const shipping = method ? Number(method.cost) : 0;
  const discountAmt = discount?.valid ? Number(discount.amount) : 0;
  const total = Math.max(0, subtotal - discountAmt) + shipping;

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const addressOk = fullName.trim() && street.trim() && city.trim() && postal.trim() && country.trim();
  const cardOk = cardName.trim() && luhnValid(cardNumber) && expiryValid(cardExpiry) && /^\d{3,4}$/.test(cardCvc.trim());
  const canPlace = emailOk && addressOk && cardOk && !place.isPending;

  const invalid = (cond: boolean) => triedSubmit && !cond;

  function submit() {
    setTriedSubmit(true);
    setError(null);
    if (!emailOk) return setError("Enter a valid email address.");
    if (!addressOk) return setError("Please complete your shipping address.");
    if (!cardOk) return setError("Please enter valid card details.");
    place.mutate();
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        {/* ── Form ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Contact */}
          <Section title="Contact information">
            <Field label="Email">
              <input className={inp(invalid(emailOk))} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Phone" optional>
              <input className={inp(false)} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </Section>

          {/* Shipping address */}
          <Section title="Shipping address" icon={MapPin}>
            {savedShipping.length > 0 && (
              <Field label="Use a saved address">
                <select
                  className={inp(false)}
                  defaultValue=""
                  onChange={(e) => {
                    const a = savedShipping.find((x) => x.id === e.target.value);
                    if (a) applyAddress(a);
                  }}
                >
                  <option value="">Enter a new address…</option>
                  {savedShipping.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name} — {a.line1}, {a.city}
                      {a.is_default ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Full name">
              <input className={inp(invalid(!!fullName.trim()))} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label="Street address">
              <input className={inp(invalid(!!street.trim()))} value={street} onChange={(e) => setStreet(e.target.value)} />
            </Field>
            <Field label="Apartment, suite, etc." optional>
              <input className={inp(false)} value={apartment} onChange={(e) => setApartment(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <input className={inp(invalid(!!city.trim()))} value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Field label="Postal code">
                <input className={inp(invalid(!!postal.trim()))} value={postal} onChange={(e) => setPostal(e.target.value)} />
              </Field>
            </div>
            <Field label="Country">
              <input className={inp(invalid(!!country.trim()))} value={country} onChange={(e) => setCountry(e.target.value)} />
            </Field>
          </Section>

          {/* Shipping method */}
          <Section title="Shipping method" icon={Truck}>
            <div className="space-y-2">
              {(methods ?? []).map((m) => (
                <label
                  key={m.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-3",
                    methodId === m.id ? "border-brand-500 bg-brand-50" : "border-slate-200",
                  )}
                >
                  <input type="radio" name="method" checked={methodId === m.id} onChange={() => setMethodId(m.id)} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{m.label}</p>
                    <p className="text-xs text-slate-500">{m.estimate}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{m.free ? "Free" : `€${m.cost}`}</span>
                </label>
              ))}
            </div>
          </Section>

          {/* Payment */}
          <Section title="Payment" icon={Lock}>
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Secured & encrypted · card details never touch our
              servers · <span className="font-medium">test mode</span>
            </div>
            <Field label="Name on card">
              <input className={inp(invalid(!!cardName.trim()))} value={cardName} onChange={(e) => setCardName(e.target.value)} />
            </Field>
            <Field label="Card number">
              <input
                className={inp(invalid(luhnValid(cardNumber)))}
                inputMode="numeric"
                placeholder="4242 4242 4242 4242"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expiry (MM/YY)">
                <input className={inp(invalid(expiryValid(cardExpiry)))} placeholder="12/28" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} />
              </Field>
              <Field label="CVC">
                <input className={inp(invalid(/^\d{3,4}$/.test(cardCvc.trim())))} inputMode="numeric" placeholder="123" value={cardCvc} onChange={(e) => setCardCvc(e.target.value)} />
              </Field>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="rounded border border-slate-200 px-2 py-1">Apple Pay — soon</span>
              <span className="rounded border border-slate-200 px-2 py-1">Google Pay — soon</span>
              <span className="rounded border border-slate-200 px-2 py-1">PayPal — soon</span>
            </div>
          </Section>
        </div>

        {/* ── Order review (sticky summary) ───────────────────── */}
        <div>
          <Card className="lg:sticky lg:top-6">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="font-semibold text-slate-900">Order review · {group.name}</h2>
            </div>
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {group.items.map((i) => (
                <li key={`${i.shop_item_id}|${i.color}|${i.size}`} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                    <DesignPreviewThumb baseImageUrl={i.base_image_url} designUrl={i.design_url} pos_x={i.pos_x} pos_y={i.pos_y} scale={i.scale} rotation={i.rotation} />
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium text-slate-800">{i.name}</p>
                    <p className="text-xs text-slate-500">{[i.color, i.size].filter(Boolean).join(" · ")} · ×{i.quantity}</p>
                  </div>
                  <span className="text-sm text-slate-700">€{(Number(i.price) * i.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-slate-100 px-5 py-4 text-sm">
              <Row label="Subtotal" value={`€${subtotal.toFixed(2)}`} />
              {discountAmt > 0 && <Row label={`Discount${discount?.valid ? ` (${discountCode})` : ""}`} value={`− €${discountAmt.toFixed(2)}`} accent />}
              <Row label="Shipping" value={shipping === 0 ? "Free" : `€${shipping.toFixed(2)}`} />
              <div className="border-t border-slate-100 pt-1.5">
                <Row label="Total" value={`€${total.toFixed(2)}`} strong />
              </div>
            </dl>

            {error && <p className="px-5 pb-2 text-sm text-red-600">{error}</p>}

            <div className="px-5 pb-5">
              <Button className="w-full" onClick={submit} disabled={place.isPending}>
                {place.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Place order · €{total.toFixed(2)}
              </Button>
              {!canPlace && triedSubmit && (
                <p className="mt-2 text-center text-xs text-slate-400">Complete the fields above to place your order.</p>
              )}
              <p className="mt-2 text-center text-xs text-slate-400">No real charge — payments are stubbed.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function inp(bad: boolean): string {
  return cn("input", bad && "border-red-400");
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Truck; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
        {Icon && <Icon className="h-4 w-4 text-slate-400" />} {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">
        {label} {optional && <span className="font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? "font-semibold text-slate-900" : "text-slate-500"}>{label}</dt>
      <dd className={strong ? "font-semibold text-slate-900" : accent ? "text-emerald-600" : "text-slate-700"}>{value}</dd>
    </div>
  );
}
