import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listOrders, type OrderDisplayStatus, type OrderSort } from "../../../api/orders";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { cn } from "../../../lib/cn";
import { ORDER_STATUS } from "../../../lib/orderStatus";
import { timeAgo } from "../../../lib/timeAgo";

type Tab = "ALL" | OrderDisplayStatus;

const TABS: Tab[] = ["ALL", "PAID", "IN_PRODUCTION", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

const SORTS: { value: OrderSort; label: string }[] = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "total_desc", label: "Revenue: high to low" },
  { value: "total_asc", label: "Revenue: low to high" },
  { value: "earnings_desc", label: "Earnings: high to low" },
];

export default function SellerOrders() {
  const [tab, setTab] = useState<Tab>("ALL");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [sort, setSort] = useState<OrderSort>("date_desc");

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const filters = {
    status: tab === "ALL" ? undefined : tab,
    q: q.trim() || undefined,
    date_from: dateFrom || undefined,
    sort,
  };
  const { data, isLoading } = useQuery({
    queryKey: ["orders", filters],
    queryFn: () => listOrders(filters),
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];
  const counts = data?.counts;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const filtersOn = !!(qInput.trim() || dateFrom);

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Everything sold through your storefront — from payment to delivery."
      />

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {TABS.map((t) => {
          const count = t === "ALL" ? total : (counts?.[t] ?? 0);
          const label = t === "ALL" ? "All" : ORDER_STATUS[t].label;
          if (t !== "ALL" && count === 0 && tab !== t) return null; // hide empty stages
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                tab === t ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {label}
              {count > 0 && (
                <span className={cn("ml-1.5", tab === t ? "text-white/75" : "text-slate-400")}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search customer, order # or product…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </div>
        <input
          type="date"
          className="input w-auto"
          title="Orders on or after"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as OrderSort)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {filtersOn && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQInput("");
              setQ("");
              setDateFrom("");
            }}
          >
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={ShoppingBag}
            title={filtersOn || tab !== "ALL" ? "No orders match" : "No orders yet"}
            hint={
              filtersOn || tab !== "ALL"
                ? "Try a different search, status or date."
                : "Share your storefront — sales land here the moment a customer pays."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[auto_1.2fr_1.6fr_1fr_auto_auto_auto] items-center gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 md:grid">
            <span>Order</span>
            <span>Customer</span>
            <span>Products</span>
            <span>Date</span>
            <span className="text-right">Total</span>
            <span className="text-right">You earn</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {items.map((o) => {
              const st = ORDER_STATUS[o.status];
              return (
                <li key={o.id}>
                  <Link
                    to={`/seller/orders/${o.id}`}
                    className="grid grid-cols-2 items-center gap-2 px-5 py-3.5 transition hover:bg-slate-50 md:grid-cols-[auto_1.2fr_1.6fr_1fr_auto_auto_auto] md:gap-4"
                  >
                    <span className="font-mono text-sm font-medium text-slate-700">#{o.short_id}</span>
                    <span className="truncate text-sm text-slate-700">{o.customer_name}</span>
                    <span className="truncate text-sm text-slate-500">{o.product_summary}</span>
                    <span className="text-sm text-slate-400" title={new Date(o.created_at).toLocaleString()}>
                      {timeAgo(o.created_at)}
                    </span>
                    <span className="text-right text-sm font-semibold text-slate-900">€{o.total}</span>
                    <span className="text-right text-sm text-emerald-600">€{o.earnings}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
