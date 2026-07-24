import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, MapPin, Package2, Truck } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { getOrderConfirmation } from "../api/marketplace";
import { useAuth } from "../auth";
import { DesignPreviewThumb } from "../components/design/DesignPreviewThumb";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

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

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Thank you! Your order is confirmed.</h1>
        <p className="mt-2 text-sm text-slate-500">
          Order <span className="font-mono font-medium text-slate-700">#{o.short_id}</span>
          {o.email ? <> · a confirmation was sent to {o.email}</> : null}
        </p>
      </div>

      <Card className="mt-8 overflow-hidden">
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
        </Card>
        <Card className="p-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <MapPin className="h-4 w-4 text-slate-400" /> Delivering to
          </h3>
          <p className="text-sm text-slate-600">{o.ship_name}</p>
          <p className="text-sm text-slate-500">{ship || "—"}</p>
        </Card>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        {user ? (
          <Link to="/orders">
            <Button>Track your orders</Button>
          </Link>
        ) : (
          <>
            <Link to={`/signup?next=/orders`}>
              <Button>Create an account to track it</Button>
            </Link>
            <p className="text-xs text-slate-400">Sign up with {o.email} to keep this order in your history.</p>
          </>
        )}
        <Link to="/marketplace" className="text-sm font-medium text-brand-700 hover:underline">
          Continue shopping →
        </Link>
      </div>
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
