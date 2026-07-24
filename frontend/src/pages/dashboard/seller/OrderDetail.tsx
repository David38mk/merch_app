import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, CreditCard, Loader2, MapPin, RotateCcw, Truck, User } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { cancelOrder, getOrder, refundOrder } from "../../../api/orders";
import { DesignPreviewThumb } from "../../../components/design/DesignPreviewThumb";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { apiError } from "../../../lib/apiError";
import { cn } from "../../../lib/cn";
import { ORDER_EVENT_LABELS, ORDER_STATUS, ORDER_STEPS } from "../../../lib/orderStatus";

export default function OrderDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "refund" | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id),
    // The print shop advances fulfillment on its side — keep the timeline fresh.
    refetchInterval: 15000,
  });

  const act = useMutation({
    mutationFn: (kind: "cancel" | "refund") => (kind === "cancel" ? cancelOrder(id) : refundOrder(id)),
    onSuccess: (d) => {
      qc.setQueryData(["order", id], d);
      qc.invalidateQueries({ queryKey: ["orders"] });
      setConfirm(null);
      setError(null);
    },
    onError: (e) => {
      setConfirm(null);
      setError(apiError(e, "That didn't work."));
    },
  });

  if (isLoading || !order) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const st = ORDER_STATUS[order.status];
  // Stepper state from the event log: a step is done once its event exists.
  const eventAt = new Map(order.events.map((e) => [e.type, e.created_at]));
  const active = order.status !== "CANCELLED" && order.status !== "REFUNDED";
  const doneCount = ORDER_STEPS.filter((s) => eventAt.has(s)).length;

  return (
    <div>
      <Link
        to="/seller/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <PageHeader
        title={`Order #${order.short_id}`}
        subtitle={`Placed ${new Date(order.created_at).toLocaleString()}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
            {order.can_cancel && (
              <Button variant="outline" size="sm" onClick={() => setConfirm("cancel")}>
                <Ban className="h-4 w-4" /> Cancel
              </Button>
            )}
            {order.can_refund && (
              <Button variant="outline" size="sm" onClick={() => setConfirm("refund")}>
                <RotateCcw className="h-4 w-4" /> Refund
              </Button>
            )}
          </div>
        }
      />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* Fulfillment stepper — the whole expected path, done → current → upcoming.
          A cancelled/refunded order shows only the factual event log below. */}
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
                  <p
                    className={cn(
                      "mt-2 text-xs font-medium",
                      done ? "text-slate-800" : "text-slate-400",
                    )}
                  >
                    {ORDER_EVENT_LABELS[step]}
                  </p>
                  {at && (
                    <p className="text-[10px] text-slate-400">
                      {new Date(at).toLocaleDateString()}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Items — mockup at the purchased placement + per-line economics */}
          <Card className="overflow-hidden">
            <h2 className="border-b border-slate-100 px-5 py-4 font-semibold text-slate-900">Items</h2>
            <ul className="divide-y divide-slate-100">
              {order.items.map((it) => {
                const lineRevenue = Number(it.unit_price) * it.quantity;
                const lineCost = it.production_cost ? Number(it.production_cost) * it.quantity : null;
                return (
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
                      {lineCost !== null && (
                        <p className="text-xs text-slate-400">
                          Production €{it.production_cost} each · €{lineCost.toFixed(2)} total
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">€{it.unit_price}</p>
                      <p className="text-xs text-slate-400">per unit · €{lineRevenue.toFixed(2)} line</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <dl className="space-y-1.5 border-t border-slate-100 px-5 py-4 text-sm">
              <Row label="Subtotal" value={`€${order.subtotal}`} />
              <Row label="Production cost" value={`− €${order.production_total}`} />
              <Row
                label={`Platform fee (${Math.round(Number(order.commission_rate) * 100)}%)`}
                value={`− €${order.commission_amount}`}
              />
              <Row label="Your profit" value={`€${order.earnings}`} strong />
            </dl>
          </Card>

          {/* Event log — every recorded fact with notes (tracking, refunds…) */}
          <Card className="p-5">
            <h2 className="font-semibold text-slate-900">Timeline</h2>
            <ol className="mt-4 space-y-4">
              {order.events.map((e, i) => (
                <li key={`${e.type}-${i}`} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                      i === order.events.length - 1 ? "bg-brand-600" : "bg-slate-300",
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {ORDER_EVENT_LABELS[e.type] ?? e.type}
                    </p>
                    {e.note && <p className="text-sm text-slate-500">{e.note}</p>}
                    <p className="text-xs text-slate-400">{new Date(e.created_at).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <User className="h-4 w-4 text-slate-400" /> Customer
            </h2>
            <p className="mt-3 text-sm font-medium text-slate-800">{order.customer_name}</p>
            {order.customer_email && <p className="text-sm text-slate-500">{order.customer_email}</p>}
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <MapPin className="h-4 w-4 text-slate-400" /> Shipping address
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm text-slate-600">
              {[order.ship_name, order.ship_address, `${order.ship_postal ?? ""} ${order.ship_city ?? ""}`.trim(), order.ship_country]
                .filter(Boolean)
                .join("\n")}
            </p>
            {order.tracking_number && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-700">
                <Truck className="h-4 w-4 text-slate-400" />
                Tracking: <span className="font-mono font-medium">{order.tracking_number}</span>
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <CreditCard className="h-4 w-4 text-slate-400" /> Payment
            </h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row label="Method" value={order.payment_method} />
              <Row
                label="Paid at"
                value={order.paid_at ? new Date(order.paid_at).toLocaleString() : "—"}
              />
              <Row label="Total" value={`€${order.subtotal}`} strong />
            </dl>
          </Card>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="max-w-sm p-6">
            <h3 className="font-semibold text-slate-900">
              {confirm === "cancel" ? "Cancel this order?" : `Refund €${order.subtotal}?`}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {confirm === "cancel"
                ? "The order stops before production and the customer is not charged further."
                : "The full amount goes back to the customer (test payment — no real money moves)."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Keep order
              </Button>
              <Button onClick={() => act.mutate(confirm)} disabled={act.isPending}>
                {act.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {confirm === "cancel" ? "Cancel order" : "Refund"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={strong ? "font-semibold text-slate-900" : "text-slate-700"}>{value}</dd>
    </div>
  );
}
