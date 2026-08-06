import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Check, CircleCheck, CircleDashed, CreditCard, Loader2, MapPin, Package2, Store, Truck } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { getOrderConfirmation, type OrderConfirmation } from "../api/marketplace";
import { useAuth } from "../auth";
import { DesignPreviewThumb } from "../components/design/DesignPreviewThumb";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

// How far along the order is — drives which "Next steps" are ticked. A fresh
// confirmation is always PAID (only the first step done); the same tracker keeps
// working as the print shop advances the order.
const STAGE: Record<string, number> = {
  PENDING_PAYMENT: 0,
  PAID: 1,
  IN_PRODUCTION: 2,
  SHIPPED: 3,
  DELIVERED: 4,
};

const fmtFull = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

function deliveryText(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  const f = new Date(from);
  const t = new Date(to);
  const fromStr = f.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const toStr = t.toLocaleDateString(
    undefined,
    f.getMonth() === t.getMonth() ? { day: "numeric" } : { month: "short", day: "numeric" },
  );
  return `${fromStr}–${toStr}`;
}

export default function OrderConfirmed() {
  const { token = "" } = useParams();
  const { user } = useAuth();
  const { data: o, isLoading, isError } = useQuery({
    queryKey: ["order-confirmation", token],
    queryFn: () => getOrderConfirmation(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (isError || !o) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Package2 className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Confirmation link expired</h1>
        <p className="mt-2 text-sm text-slate-500">This confirmation link is no longer valid.</p>
        <Link to="/marketplace" className="mt-6 inline-block">
          <Button variant="outline">Back to marketplace</Button>
        </Link>
      </div>
    );
  }

  const ship = [o.ship_address, o.ship_city, o.ship_postal, o.ship_country].filter(Boolean).join(", ");
  const num = (v: string) => Number(v);
  const stage = STAGE[o.status] ?? 1;
  const delivery = deliveryText(o.est_delivery_from, o.est_delivery_to);

  const steps = [
    { label: "Order received", hint: "We've got your order.", done: stage >= 1 },
    { label: "Production starting soon", hint: "Your items head to the print partner.", done: stage >= 2 },
    { label: "Shipping updates on the way", hint: "You'll get tracking by email.", done: stage >= 3 },
    { label: delivery ? `Estimated delivery ${delivery}` : "Delivery", hint: "Right to your door.", done: stage >= 4 },
  ];

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Thank you! Your order is confirmed.</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your order has been successfully placed and is now being processed.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Order <span className="font-mono font-medium text-slate-700">#{o.short_id}</span>
          {o.email ? <> · a confirmation was sent to {o.email}</> : null}
        </p>
      </div>

      {/* Order meta: date + payment method */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Meta icon={CalendarClock} label="Order date" value={fmtFull(o.created_at)} />
        <Meta icon={CreditCard} label="Payment" value={o.payment_method ?? "Card"} />
      </div>

      {/* Next steps — status-driven tracker */}
      <Card className="mt-4 p-5">
        <h2 className="mb-4 font-semibold text-slate-900">What happens next</h2>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              {s.done ? (
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
              )}
              <div>
                <p className={s.done ? "text-sm font-medium text-slate-800" : "text-sm font-medium text-slate-500"}>
                  {s.label}
                </p>
                <p className="text-xs text-slate-400">{s.hint}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{o.store_name}</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {o.items.map((i, idx) => (
            <li key={idx} className="flex items-center gap-3 px-5 py-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                <DesignPreviewThumb baseImageUrl={i.base_image_url} designUrl={i.design_url} pos_x={i.pos_x} pos_y={i.pos_y} scale={i.scale} rotation={i.rotation} />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium text-slate-800">{i.name}</p>
                <p className="text-xs text-slate-500">{[i.color, i.size].filter(Boolean).join(" · ")} · ×{i.quantity}</p>
              </div>
              <span className="text-sm text-slate-700">€{(num(i.unit_price) * i.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 border-t border-slate-100 px-5 py-4 text-sm">
          <Row label="Subtotal" value={`€${num(o.subtotal).toFixed(2)}`} />
          {num(o.discount_amount) > 0 && <Row label={`Discount${o.discount_code ? ` (${o.discount_code})` : ""}`} value={`− €${num(o.discount_amount).toFixed(2)}`} accent />}
          <Row label="Shipping" value={num(o.shipping_amount) === 0 ? "Free" : `€${num(o.shipping_amount).toFixed(2)}`} />
          {num(o.tax_amount) > 0 && <Row label="Tax" value={`€${num(o.tax_amount).toFixed(2)}`} />}
          <div className="border-t border-slate-100 pt-1.5">
            <Row label="Total paid" value={`€${num(o.total).toFixed(2)}`} strong />
          </div>
        </dl>
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <Truck className="h-4 w-4 text-slate-400" /> Shipping
          </h3>
          <p className="text-sm text-slate-600">{o.shipping_method}{o.shipping_estimate ? ` · ${o.shipping_estimate}` : ""}</p>
          {delivery && <p className="mt-1 text-sm text-slate-500">Estimated delivery {delivery}</p>}
        </Card>
        <Card className="p-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <MapPin className="h-4 w-4 text-slate-400" /> Delivering to
          </h3>
          <p className="text-sm text-slate-600">{o.ship_name}</p>
          <p className="text-sm text-slate-500">{ship || "—"}</p>
        </Card>
      </div>

      <Actions o={o} user={!!user} />
    </div>
  );
}

function Actions({ o, user }: { o: OrderConfirmation; user: boolean }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-3">
        {user ? (
          <Link to="/orders">
            <Button>Track your order</Button>
          </Link>
        ) : (
          <Link to={`/signup?next=/orders`}>
            <Button>Create an account to track it</Button>
          </Link>
        )}
        {o.store_slug && (
          <Link to={`/store/${o.store_slug}`}>
            <Button variant="outline">
              <Store className="h-4 w-4" /> Visit {o.store_name ?? "the brand store"}
            </Button>
          </Link>
        )}
      </div>
      {!user && (
        <p className="text-xs text-slate-400">Sign up with {o.email} to keep this order in your history.</p>
      )}
      <Link to="/marketplace" className="text-sm font-medium text-brand-700 hover:underline">
        Continue shopping →
      </Link>
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof CreditCard; label: string; value: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <Icon className="h-5 w-5 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-800">{value}</p>
      </div>
    </Card>
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
