import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MapPin, Store, Truck } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { getBuyerOrder } from "../../../api/buyerOrders";
import { DesignPreviewThumb } from "../../../components/design/DesignPreviewThumb";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { cn } from "../../../lib/cn";
import { ORDER_EVENT_LABELS, ORDER_STATUS, ORDER_STEPS } from "../../../lib/orderStatus";

export default function BuyerOrderDetail() {
  const { id = "" } = useParams();
  const { data: order, isLoading } = useQuery({
    queryKey: ["buyer-order", id],
    queryFn: () => getBuyerOrder(id),
    refetchInterval: 30000, // the print shop advances fulfillment on its side
  });

  if (isLoading || !order) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const st = ORDER_STATUS[order.status];
  const eventAt = new Map(order.events.map((e) => [e.type, e.created_at]));
  const active = order.status !== "CANCELLED" && order.status !== "REFUNDED";
  const doneCount = ORDER_STEPS.filter((s) => eventAt.has(s)).length;
  const ship = [order.ship_address, order.ship_city, order.ship_postal, order.ship_country]
    .filter(Boolean)
    .join(", ");

  return (
    <div>
      <Link
        to="/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to my orders
      </Link>

      <PageHeader
        title={`Order #${order.short_id}`}
        subtitle={`Placed ${new Date(order.created_at).toLocaleString()}`}
        actions={<Badge tone={st.tone}>{st.label}</Badge>}
      />

      {/* Tracking banner — the buyer's headline question is "where is it?" */}
      {order.tracking_number && (
        <Card className="mb-6 flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Truck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-900">Tracking number</p>
            <p className="font-mono text-sm text-slate-600">{order.tracking_number}</p>
          </div>
        </Card>
      )}

      {/* Fulfillment stepper — done → current → upcoming. */}
      {active && (
        <Card className="mb-6 overflow-x-auto p-5">
          <ol className="flex min-w-[640px] items-start">
            {ORDER_STEPS.map((step, i) => {
              const at = eventAt.get(step);
              const done = !!at;
              const current = done && i === doneCount - 1;
              return (
                <li key={step} className="relative flex-1 text-center">
                  {i > 0 && (
                    <span
                      className={cn(
                        "absolute left-[-50%] top-3 h-0.5 w-full",
                        done ? "bg-brand-500" : "bg-slate-200",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 mx-auto flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white",
                      done ? "border-brand-500" : "border-slate-200",
                      current && "bg-brand-600 border-brand-600",
                    )}
                  >
                    {done && !current && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                    {current && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                  <p className={cn("mt-2 text-xs font-medium", done ? "text-slate-800" : "text-slate-400")}>
                    {ORDER_EVENT_LABELS[step]}
                  </p>
                  {at && <p className="text-[10px] text-slate-400">{new Date(at).toLocaleDateString()}</p>}
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="overflow-hidden">
            <h2 className="border-b border-slate-100 px-5 py-4 font-semibold text-slate-900">Items</h2>
            <ul className="divide-y divide-slate-100">
              {order.items.map((it) => (
                <li key={it.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                    <DesignPreviewThumb
                      baseImageUrl={it.base_image_url}
                      designUrl={it.design_url}
                      pos_x={it.pos_x}
                      pos_y={it.pos_y}
                      scale={it.scale}
                      rotation={it.rotation}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{it.name}</p>
                    <p className="text-sm text-slate-500">
                      {[it.color, it.size].filter(Boolean).join(" · ") || "—"} · ×{it.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">€{it.unit_price}</p>
                    <p className="text-xs text-slate-400">per unit</p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-slate-100 px-5 py-4 text-sm">
              <BreakdownRow label="Subtotal" value={`€${order.subtotal}`} />
              {Number(order.discount_amount) > 0 && (
                <BreakdownRow
                  label={`Discount${order.discount_code ? ` (${order.discount_code})` : ""}`}
                  value={`− €${order.discount_amount}`}
                  accent
                />
              )}
              <BreakdownRow label="Shipping" value={Number(order.shipping_amount) === 0 ? "Free" : `€${order.shipping_amount}`} />
              {Number(order.tax_amount) > 0 && <BreakdownRow label="Tax" value={`€${order.tax_amount}`} />}
              <div className="border-t border-slate-100 pt-1.5">
                <BreakdownRow label="Total paid" value={`€${order.total}`} strong />
              </div>
            </dl>
          </Card>

          {/* Full factual timeline (tracking notes, cancellation, refund…). */}
          <Card className="p-5">
            <h2 className="font-semibold text-slate-900">Timeline</h2>
            <ol className="mt-4 space-y-4">
              {order.events.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {ORDER_EVENT_LABELS[e.type] ?? e.type}
                    </p>
                    {e.note && <p className="text-xs text-slate-500">{e.note}</p>}
                    <p className="text-[10px] text-slate-400">{new Date(e.created_at).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          {order.store_name && (
            <Card className="p-5">
              <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                <Store className="h-4 w-4 text-slate-400" /> Storefront
              </h2>
              <p className="text-sm text-slate-600">{order.store_name}</p>
              {order.store_slug && (
                <Link
                  to={`/store/${order.store_slug}`}
                  className="mt-1 inline-block text-sm font-medium text-brand-700 hover:underline"
                >
                  Visit store →
                </Link>
              )}
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
              <MapPin className="h-4 w-4 text-slate-400" /> Shipping to
            </h2>
            <p className="text-sm text-slate-600">{order.ship_name}</p>
            <p className="text-sm text-slate-500">{ship || "—"}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BreakdownRow({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? "font-semibold text-slate-900" : "text-slate-500"}>{label}</dt>
      <dd className={strong ? "font-semibold text-slate-900" : accent ? "text-emerald-600" : "text-slate-700"}>{value}</dd>
    </div>
  );
}
