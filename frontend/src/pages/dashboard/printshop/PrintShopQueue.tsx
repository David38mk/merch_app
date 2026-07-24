import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Factory, Inbox, Loader2, Package, Truck, X } from "lucide-react";
import { useState } from "react";

import { advanceProduction, getProductionQueue, type QueueItem } from "../../../api/orders";
import { DesignPreviewThumb } from "../../../components/design/DesignPreviewThumb";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Stat } from "../../../components/ui/Stat";
import { apiError } from "../../../lib/apiError";
import type { Tone } from "../../../components/ui/Badge";

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  PAID: { label: "To produce", tone: "slate" },
  IN_PRODUCTION: { label: "In production", tone: "amber" },
  QUALITY_CHECK: { label: "Quality check", tone: "brand" },
  HANDED_TO_SHIPMENT: { label: "Shipped", tone: "brand" },
  SHIPPED: { label: "Shipped", tone: "brand" },
  DELIVERED: { label: "Delivered", tone: "green" },
};

export default function PrintShopQueue() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  // Marking shipped needs a tracking number — collected in a tiny dialog.
  const [shipping, setShipping] = useState<QueueItem | null>(null);
  const [tracking, setTracking] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["production-queue"],
    queryFn: getProductionQueue,
    refetchInterval: 20000, // new paid orders appear without a manual refresh
  });

  const advance = useMutation({
    mutationFn: ({ id, trackingNumber }: { id: string; trackingNumber?: string }) =>
      advanceProduction(id, trackingNumber),
    onSuccess: (q) => {
      qc.setQueryData(["production-queue"], q);
      setShipping(null);
      setTracking("");
      setError(null);
    },
    onError: (e) => setError(apiError(e, "Couldn't update that item.")),
  });

  function act(item: QueueItem) {
    // Shipping is the step that carries a tracking number — ask for it.
    // (It follows quality check in the chain: QC → shipped.)
    if (item.status === "QUALITY_CHECK") {
      setShipping(item);
      return;
    }
    advance.mutate({ id: item.id });
  }

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader title="Production queue" subtitle="Paid orders to make, ship and deliver." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Inbox} label="To produce" value={String(data?.to_produce ?? 0)} hint="paid, waiting" />
        <Stat icon={Factory} label="In production" value={String(data?.in_production ?? 0)} />
        <Stat icon={Truck} label="Shipped" value={String(data?.shipped ?? 0)} />
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <Card className="mt-6 overflow-hidden">
        <div className="hidden grid-cols-[3rem_1.6fr_1fr_auto_1fr_auto_auto] items-center gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 md:grid">
          <span />
          <span>Product</span>
          <span>Variant</span>
          <span>Qty</span>
          <span>Store / order</span>
          <span>Status</span>
          <span />
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Package}
              title="Queue is empty"
              hint="When a buyer's order is paid, the items you fulfil land here to move paid → in production → shipped → delivered."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((it) => {
              const meta = STATUS_META[it.status] ?? { label: it.status, tone: "slate" as Tone };
              return (
                <li
                  key={it.id}
                  className="grid grid-cols-2 items-center gap-2 px-5 py-3.5 md:grid-cols-[3rem_1.6fr_1fr_auto_1fr_auto_auto] md:gap-4"
                >
                  <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200">
                    <DesignPreviewThumb
                      baseImageUrl={it.base_image_url}
                      designUrl={it.design_url}
                      pos_x={50}
                      pos_y={45}
                      scale={0.45}
                      rotation={0}
                    />
                  </div>
                  <span className="truncate text-sm font-medium text-slate-800">{it.product_name}</span>
                  <span className="text-sm text-slate-500">
                    {[it.color, it.size].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <span className="text-sm text-slate-700">×{it.quantity}</span>
                  <span className="truncate text-sm text-slate-500">
                    {it.store_name ?? "—"} · <span className="font-mono">#{it.order_short_id}</span>
                  </span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  {it.next_action ? (
                    <Button size="sm" onClick={() => act(it)} disabled={advance.isPending}>
                      {it.next_action}
                    </Button>
                  ) : (
                    <span className="text-sm text-slate-400">Done</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {shipping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-sm p-6">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-slate-900">Mark “{shipping.product_name}” shipped</h3>
              <button onClick={() => setShipping(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="label mt-4">Tracking number</label>
            <input
              className="input"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="e.g. TRK-123456789"
              autoFocus
            />
            <p className="mt-1.5 text-xs text-slate-400">
              The seller (and later the buyer) sees this on the order. 🔌 Carrier integration comes later.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShipping(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => advance.mutate({ id: shipping.id, trackingNumber: tracking.trim() || undefined })}
                disabled={advance.isPending}
              >
                {advance.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Mark shipped
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
