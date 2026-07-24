import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, ShoppingBag, Truck } from "lucide-react";
import { Link } from "react-router-dom";

import { getBuyerOrders } from "../../../api/buyerOrders";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { ORDER_STATUS } from "../../../lib/orderStatus";

export default function BuyerOrders() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["buyer-orders"],
    queryFn: getBuyerOrders,
    // Fulfillment advances on the print shop's side — keep statuses fresh.
    refetchInterval: 30000,
  });

  return (
    <div>
      <PageHeader title="My orders" subtitle="Everything you've bought across storefronts." />

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !orders || orders.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={ShoppingBag}
            title="No orders yet"
            hint="Find something you like on a creator's storefront and check out."
            action={
              <Link to="/">
                <Button size="sm">Explore storefronts</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const st = ORDER_STATUS[o.status];
            return (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`}>
                  <Card className="flex items-center gap-4 p-4 transition hover:shadow-pop">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-300">
                      {o.thumbnail_url ? (
                        <img src={o.thumbnail_url} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <Package className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-slate-900">{o.product_summary}</p>
                      </div>
                      <p className="truncate text-sm text-slate-500">
                        {o.store_name ?? "Storefront"} · #{o.short_id} ·{" "}
                        {new Date(o.created_at).toLocaleDateString()}
                      </p>
                      {o.tracking_number && (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400">
                          <Truck className="h-3 w-3" /> {o.tracking_number}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <p className="mt-1 text-sm font-semibold text-slate-900">€{o.total}</p>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
