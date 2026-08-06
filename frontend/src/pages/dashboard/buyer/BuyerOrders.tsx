import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Package, RotateCcw, Search, ShoppingBag, Truck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { getBuyerOrders, reorder, type BuyerOrderFilters } from "../../../api/buyerOrders";
import type { OrderDisplayStatus } from "../../../api/orders";
import { useCart } from "../../../cart";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { apiError } from "../../../lib/apiError";
import { ORDER_STATUS } from "../../../lib/orderStatus";

const STATUS_OPTIONS: { value: OrderDisplayStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "PENDING_PAYMENT", label: "Pending payment" },
  { value: "PAID", label: "Paid" },
  { value: "IN_PRODUCTION", label: "In production" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
];

export default function BuyerOrders() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const [reorderMsg, setReorderMsg] = useState<string | null>(null);

  // Read filters from the URL (shareable, back-button-friendly).
  const q = params.get("q") ?? "";
  const status = (params.get("status") ?? "") as OrderDisplayStatus | "";
  const dateFrom = params.get("date_from") ?? "";
  const dateTo = params.get("date_to") ?? "";

  // Debounce the search box into the URL so we don't refetch on every keystroke.
  const [search, setSearch] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => {
      setParams(
        (p) => {
          if (search) p.set("q", search);
          else p.delete("q");
          return p;
        },
        { replace: true },
      );
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filters: BuyerOrderFilters = {
    q: q || undefined,
    status: status || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  };

  const { data: orders, isLoading, isFetching } = useQuery({
    queryKey: ["buyer-orders", filters],
    queryFn: () => getBuyerOrders(filters),
    refetchInterval: 30000, // fulfillment advances on the print shop's side
  });

  const setParam = (key: string, value: string) =>
    setParams(
      (p) => {
        if (value) p.set(key, value);
        else p.delete(key);
        return p;
      },
      { replace: true },
    );

  const anyFilter = Boolean(q || status || dateFrom || dateTo);

  const doReorder = useMutation({
    mutationFn: (id: string) => reorder(id),
    onSuccess: (res) => {
      res.added.forEach((l) => add({ ...l, price: String(l.price) }));
      if (res.added.length > 0) {
        navigate("/cart", { state: { reorder: { added: res.added.length, unavailable: res.unavailable } } });
      } else {
        setReorderMsg("None of these items are available to reorder right now.");
      }
    },
    onError: (e) => setReorderMsg(apiError(e, "Couldn't reorder that order.")),
  });

  return (
    <div>
      <PageHeader title="My orders" subtitle="Everything you've bought across storefronts." />

      {/* Search + filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search product, brand or order #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={status} onChange={(e) => setParam("status", e.target.value)}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-500">
          From
          <input type="date" className="input w-auto" value={dateFrom} onChange={(e) => setParam("date_from", e.target.value)} />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-500">
          To
          <input type="date" className="input w-auto" value={dateTo} onChange={(e) => setParam("date_to", e.target.value)} />
        </label>
        {anyFilter && (
          <button
            onClick={() => {
              setSearch("");
              setParams({}, { replace: true });
            }}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}
        {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-300" />}
      </div>

      {reorderMsg && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {reorderMsg}
          <button onClick={() => setReorderMsg(null)} className="text-amber-700 hover:text-amber-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !orders || orders.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={ShoppingBag}
            title={anyFilter ? "No orders match your search" : "No orders yet"}
            hint={
              anyFilter
                ? "Try a different search term or clear the filters."
                : "Find something you like on a creator's storefront and check out."
            }
            action={
              anyFilter ? (
                <Button size="sm" variant="outline" onClick={() => { setSearch(""); setParams({}, { replace: true }); }}>
                  Clear filters
                </Button>
              ) : (
                <Link to="/">
                  <Button size="sm">Explore storefronts</Button>
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const st = ORDER_STATUS[o.status];
            return (
              <li key={o.id}>
                <Card className="flex flex-wrap items-center gap-4 p-4">
                  <Link to={`/orders/${o.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-300">
                      {o.thumbnail_url ? (
                        <img src={o.thumbnail_url} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <Package className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{o.product_summary}</p>
                      <p className="truncate text-sm text-slate-500">
                        {o.store_name ?? "Storefront"} · #{o.short_id} · {new Date(o.created_at).toLocaleDateString()}
                      </p>
                      {o.tracking_number && (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400">
                          <Truck className="h-3 w-3" /> {o.tracking_number}
                        </p>
                      )}
                    </div>
                  </Link>

                  <div className="text-right">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <p className="mt-1 text-sm font-semibold text-slate-900">€{o.total}</p>
                  </div>

                  <div className="flex w-full items-center justify-end gap-2 border-t border-slate-100 pt-3 sm:w-auto sm:border-0 sm:pt-0">
                    <Link to={`/orders/${o.id}`}>
                      <Button size="sm" variant="outline">
                        View / track
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      onClick={() => { setReorderMsg(null); doReorder.mutate(o.id); }}
                      disabled={doReorder.isPending}
                    >
                      {doReorder.isPending && doReorder.variables === o.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      Reorder
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
