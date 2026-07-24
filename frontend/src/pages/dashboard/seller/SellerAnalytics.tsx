import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  CircleDollarSign,
  Eye,
  Loader2,
  Percent,
  Receipt,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getAnalytics } from "../../../api/analytics";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Stat } from "../../../components/ui/Stat";
import { cn } from "../../../lib/cn";

// Chart hues validated against the light surface (dataviz six-checks: pass).
// One measure per chart → single hue per chart, no legends needed.
const HUE_PRIMARY = "#6366f1"; // revenue / products
const HUE_SECOND = "#0ea5e9"; // visitors
const GRID = "#f1f5f9";
const INK_MUTED = "#94a3b8";

const RANGES = [
  { key: "1", label: "Today", days: 1 },
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "custom", label: "Custom", days: 0 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

const eur = (n: number) => `€${n.toFixed(2)}`;

export default function SellerAnalytics() {
  const [range, setRange] = useState<RangeKey>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const preset = RANGES.find((r) => r.key === range)!;
  const dateFrom = range === "custom" ? customFrom || undefined : isoDaysAgo(preset.days);
  const dateTo = range === "custom" ? customTo || today : today;

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", dateFrom, dateTo],
    queryFn: () => getAnalytics(dateFrom, dateTo),
    placeholderData: keepPreviousData,
    // "Data should refresh automatically" — a quiet minute-poll is plenty here.
    refetchInterval: 60000,
  });

  // Recharts wants numbers; keep day labels short (grid stays recessive).
  const series = useMemo(
    () =>
      (data?.by_day ?? []).map((d) => ({
        day: d.day.slice(5), // MM-DD
        revenue: Number(d.revenue),
        orders: d.orders,
        visitors: d.visitors,
      })),
    [data],
  );
  const countries = useMemo(
    () => (data?.by_country ?? []).slice(0, 8).map((c) => ({ ...c, revenue: Number(c.revenue) })),
    [data],
  );
  const products = useMemo(
    () => (data?.top_products ?? []).slice(0, 8).map((p) => ({ ...p, revenue: Number(p.revenue) })),
    [data],
  );
  const categories = useMemo(
    () => (data?.top_categories ?? []).map((c) => ({ ...c, revenue: Number(c.revenue) })),
    [data],
  );

  if (isLoading && !data) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="How your store is performing — updates automatically."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                    range === r.key ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {range === "custom" && (
              <div className="flex items-center gap-1.5">
                <input type="date" className="input w-auto py-1.5 text-xs" value={customFrom} max={dateTo} onChange={(e) => setCustomFrom(e.target.value)} />
                <span className="text-xs text-slate-400">→</span>
                <input type="date" className="input w-auto py-1.5 text-xs" value={customTo} max={today} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            )}
          </div>
        }
      />

      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat icon={CircleDollarSign} label="Revenue" value={eur(Number(data?.revenue ?? 0))} />
        <Stat icon={ShoppingCart} label="Orders" value={String(data?.orders ?? 0)} />
        <Stat icon={Eye} label="Visitors" value={String(data?.visitors ?? 0)} hint="unique / day" />
        <Stat
          icon={Percent}
          label="Conversion"
          value={data?.conversion != null ? `${data.conversion}%` : "—"}
          hint="orders ÷ visitors"
        />
        <Stat
          icon={Receipt}
          label="Avg. order value"
          value={data?.avg_order_value ? eur(Number(data.avg_order_value)) : "—"}
        />
      </div>

      {/* Revenue over time */}
      <Card className="mt-6 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <TrendingUp className="h-4 w-4 text-slate-400" /> Revenue over time
        </h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="day" tick={{ fill: INK_MUTED, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fill: INK_MUTED, fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => `€${v}`} />
              <Tooltip formatter={(v) => [eur(Number(v)), "Revenue"]} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="revenue" stroke={HUE_PRIMARY} strokeWidth={2} fill={HUE_PRIMARY} fillOpacity={0.08} dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Orders + Visitors — separate small multiples, one axis each */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">Orders over time</h2>
          <div className="mt-4 h-48">
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: INK_MUTED, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={{ fill: INK_MUTED, fontSize: 11 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip formatter={(v) => [String(v), "Orders"]} contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="orders" stroke={HUE_PRIMARY} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">Visitors over time</h2>
          <div className="mt-4 h-48">
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: INK_MUTED, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={{ fill: INK_MUTED, fontSize: 11 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip formatter={(v) => [String(v), "Visitors"]} contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="visitors" stroke={HUE_SECOND} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Breakdowns */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <HBarCard title="Sales by country" data={countries} nameKey="country" />
        <HBarCard title="Top products" data={products} nameKey="name" />
        <HBarCard title="Best categories" data={categories} nameKey="category" />
      </div>

      {/* Product performance table */}
      <Card className="mt-6 overflow-hidden">
        <h2 className="border-b border-slate-100 px-5 py-4 font-semibold text-slate-900">
          Product performance
        </h2>
        {products.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            No sales in this period yet — numbers appear with the first order.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3 text-right">Revenue</th>
                <th className="px-5 py-3 text-right">Units sold</th>
                <th className="px-5 py-3 text-right">Conversion</th>
                <th className="px-5 py-3 text-right">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data?.top_products ?? []).map((p) => (
                <tr key={p.shop_item_id ?? p.name}>
                  <td className="truncate px-5 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-900">
                    {eur(Number(p.revenue))}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-700">{p.units}</td>
                  <td className="px-5 py-3 text-right text-slate-700">
                    {p.conversion != null ? `${p.conversion}%` : "—"}
                  </td>
                  {/* ⏭️ lights up when buyer reviews ship */}
                  <td className="px-5 py-3 text-right text-slate-400">{p.rating ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
};

/** Horizontal bar card: thin marks, rounded data-end, value labels at bar ends. */
function HBarCard({
  title,
  data,
  nameKey,
}: {
  title: string;
  data: Record<string, unknown>[];
  nameKey: string;
}) {
  return (
    <Card className="p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {data.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">No sales in this period.</p>
      ) : (
        <div style={{ height: Math.max(140, data.length * 40) }} className="mt-4">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey={nameKey}
                width={96}
                tick={{ fill: "#475569", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip formatter={(v) => [eur(Number(v)), "Revenue"]} contentStyle={tooltipStyle} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="revenue" fill={HUE_PRIMARY} barSize={14} radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="revenue"
                  position="right"
                  formatter={(v) => `€${Math.round(Number(v))}`}
                  style={{ fill: "#64748b", fontSize: 11 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
