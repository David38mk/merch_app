import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Loader2, Palette, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { listMarketplace, type DesignerCall, type PaymentType } from "../../../api/hiring";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { cn } from "../../../lib/cn";
import { payLabel } from "../seller/SellerHiring";

type Sort = "newest" | "deadline";
const PAYMENT_LABELS: Record<PaymentType, string> = { FIXED: "Fixed price", PERCENT: "Revenue share", BOTH: "Fixed + share" };
const MIN_SHARE = [0, 5, 10, 20] as const;

function pubDate(c: DesignerCall): number {
  return new Date(c.published_at ?? c.created_at).getTime();
}

export default function DesignerCalls() {
  // Poll so newly published jobs appear and closed ones drop (real-time-ish).
  const { data, isLoading } = useQuery({
    queryKey: ["marketplace"],
    queryFn: listMarketplace,
    refetchInterval: 20_000,
  });

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [payment, setPayment] = useState<PaymentType | "">("");
  const [minShare, setMinShare] = useState(0);
  const [sort, setSort] = useState<Sort>("newest");

  const calls = data ?? [];

  // Category options are whatever product categories are present in open jobs.
  const categories = useMemo(
    () => Array.from(new Set(calls.map((c) => c.base_category).filter(Boolean) as string[])).sort(),
    [calls],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = calls.filter((c) => {
      if (needle) {
        const hay = `${c.title} ${c.seller_brand ?? ""} ${c.base_name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (category && c.base_category !== category) return false;
      if (payment && c.payment_type !== payment) return false;
      if (minShare > 0) {
        const pct = c.revenue_share_percent ? Number(c.revenue_share_percent) : 0;
        if (pct < minShare) return false;
      }
      return true;
    });
    rows.sort((a, b) => {
      if (sort === "deadline") {
        // Jobs with a deadline first (soonest), then the undated ones.
        const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const dbt = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return da - dbt;
      }
      return pubDate(b) - pubDate(a);
    });
    return rows;
  }, [calls, q, category, payment, minShare, sort]);

  const activeFilters = (category ? 1 : 0) + (payment ? 1 : 0) + (minShare > 0 ? 1 : 0);
  const clearAll = () => {
    setQ("");
    setCategory("");
    setPayment("");
    setMinShare(0);
  };

  const selectCls =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

  return (
    <div>
      <PageHeader title="Browse jobs" subtitle="Discover open briefs from sellers, compare compensation, and apply." />

      {/* Search + filter bar */}
      <div className="mb-5 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by job title, brand or product…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
          </span>

          <select className={selectCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select className={selectCls} value={payment} onChange={(e) => setPayment(e.target.value as PaymentType | "")}>
            <option value="">Any payment type</option>
            {(Object.keys(PAYMENT_LABELS) as PaymentType[]).map((p) => (
              <option key={p} value={p}>
                {PAYMENT_LABELS[p]}
              </option>
            ))}
          </select>

          <select className={selectCls} value={minShare} onChange={(e) => setMinShare(Number(e.target.value))}>
            {MIN_SHARE.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? "Any revenue share" : `Revenue share ≥ ${m}%`}
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Sort</span>
            <div className="flex overflow-hidden rounded-lg border border-slate-300">
              {(["newest", "deadline"] as Sort[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={cn(
                    "px-3 py-2 text-sm font-medium transition",
                    sort === s ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {s === "newest" ? "Newest" : "Deadline"}
                </button>
              ))}
            </div>
          </div>

          {(activeFilters > 0 || q) && (
            <button onClick={clearAll} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={Palette}
            title={calls.length === 0 ? "No open jobs right now" : "No jobs match your filters"}
            hint={
              calls.length === 0
                ? "When sellers publish job calls, they'll appear here — open one to see the full brief."
                : "Try clearing a filter or searching a different term."
            }
            action={
              calls.length > 0 ? (
                <button onClick={clearAll} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                  Clear filters
                </button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-400">
            {filtered.length} job{filtered.length === 1 ? "" : "s"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <JobCard key={c.id} call={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function JobCard({ call: c }: { call: DesignerCall }) {
  return (
    <Link to={`/designer/calls/${c.id}`}>
      <Card className="group flex h-full flex-col overflow-hidden transition hover:shadow-pop">
        <div className="relative aspect-video bg-slate-100">
          {c.base_image_url && <img src={c.base_image_url} alt="" className="h-full w-full object-cover" />}
          {c.base_category && (
            <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-700">
              {c.base_category}
            </span>
          )}
          {c.has_applied && (
            <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
              Applied
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <p className="truncate font-medium text-slate-900">{c.title}</p>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {c.seller_brand ?? "A seller"} · {c.base_name}
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-slate-500">{c.brief}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="brand">{payLabel(c)}</Badge>
            {c.design_style && <Badge tone="slate">{c.design_style}</Badge>}
          </div>

          <div className="mt-auto flex items-center justify-between pt-3 text-xs text-slate-400">
            <div className="flex flex-col gap-0.5">
              {c.deadline ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> Due {new Date(c.deadline).toLocaleDateString()}
                </span>
              ) : (
                <span>No deadline</span>
              )}
              {c.published_at && <span>Posted {new Date(c.published_at).toLocaleDateString()}</span>}
            </div>
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
