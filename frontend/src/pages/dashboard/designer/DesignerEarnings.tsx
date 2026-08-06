import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Clock, Loader2, TrendingUp, Wallet } from "lucide-react";
import { useState } from "react";

import { getEarnings, requestPayout, type Earnings, type PayoutStatus, type ProjectEarning } from "../../../api/designer";
import { Badge, type Tone } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { apiError } from "../../../lib/apiError";

const eur = (x: string | number) => `€${Number(x).toFixed(2)}`;
const PAY_LABEL: Record<ProjectEarning["payment_type"], string> = {
  FIXED: "Fixed",
  PERCENT: "Revenue share",
  BOTH: "Fixed + share",
};
const PROJECT_TONE: Record<string, Tone> = { Paid: "green", Ongoing: "brand", Pending: "amber", Unpaid: "slate" };
const PAYOUT_TONE: Record<PayoutStatus, Tone> = { PAID: "green", PROCESSING: "amber", REQUESTED: "amber", FAILED: "slate" };

export default function DesignerEarnings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["earnings"], queryFn: getEarnings });

  if (isLoading || !data) {
    return (
      <div className="flex h-40 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Earnings" subtitle="Track what you've earned across fixed-fee and revenue-share projects." />

      {/* Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Banknote} label="Total earnings" value={eur(data.total_earnings)} hint="Your lifetime cut" tone="brand" />
        <Metric icon={Wallet} label="Available balance" value={eur(data.available_balance)} hint="Withdrawable now" tone="green" />
        <Metric icon={Clock} label="Pending balance" value={eur(data.pending_balance)} hint="Clearing (undelivered / unpaid)" tone="amber" />
        <Metric icon={TrendingUp} label="Lifetime revenue" value={eur(data.lifetime_revenue)} hint="Gross sales you generated" tone="slate" />
      </div>

      <WithdrawCard earnings={data} onDone={() => qc.invalidateQueries({ queryKey: ["earnings"] })} />

      {/* Project earnings */}
      <h2 className="mb-3 mt-8 font-semibold text-slate-900">Project earnings</h2>
      {data.projects.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={Banknote}
            title="No earnings yet"
            hint="Once you complete a collaboration, its fixed fee and any revenue share will show up here."
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 font-medium">Seller</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 text-right font-medium">Earned</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p) => (
                <tr key={p.collaboration_id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.seller}</td>
                  <td className="px-4 py-3 text-slate-600">{p.product ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{PAY_LABEL[p.payment_type]}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {eur(p.amount_earned)}
                    {Number(p.pending) > 0 && (
                      <span className="ml-1 text-xs font-normal text-amber-600">({eur(p.pending)} pending)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={PROJECT_TONE[p.status] ?? "slate"}>{p.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Payout history */}
      <h2 className="mb-3 mt-8 font-semibold text-slate-900">Payout history</h2>
      {data.payouts.length === 0 ? (
        <Card className="p-6">
          <p className="text-center text-sm text-slate-400">No withdrawals yet.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Method</th>
              </tr>
            </thead>
            <tbody>
              {data.payouts.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 text-slate-600">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{eur(p.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={PAYOUT_TONE[p.status]}>{p.status[0] + p.status.slice(1).toLowerCase()}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint: string;
  tone: Tone;
}) {
  const ring: Record<Tone, string> = {
    brand: "text-brand-600 bg-brand-50",
    green: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    slate: "text-slate-500 bg-slate-100",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${ring[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
    </Card>
  );
}

function WithdrawCard({ earnings, onDone }: { earnings: Earnings; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const available = Number(earnings.available_balance);
  const min = Number(earnings.min_payout);
  const canWithdraw = available >= min;

  const withdraw = useMutation({
    mutationFn: () => requestPayout(amount === "" ? undefined : Number(amount)),
    onSuccess: () => {
      setError(null);
      setOpen(false);
      setAmount("");
      onDone();
    },
    onError: (e) => setError(apiError(e, "Couldn't process the withdrawal.")),
  });

  return (
    <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <p className="text-sm font-medium text-slate-800">Withdraw your available balance</p>
        <p className="text-xs text-slate-400">
          {canWithdraw
            ? `You can withdraw up to ${eur(available)}.`
            : `A minimum of ${eur(min)} is required to withdraw (you have ${eur(available)}).`}
        </p>
      </div>

      {open ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span>
            <input
              type="number"
              min={min}
              max={available}
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder={available.toFixed(0)}
              className="w-32 rounded-lg border border-slate-300 py-2 pl-7 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <Button size="sm" onClick={() => withdraw.mutate()} disabled={withdraw.isPending}>
            {withdraw.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Confirm
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button onClick={() => setOpen(true)} disabled={!canWithdraw}>
          <Wallet className="h-4 w-4" /> Request withdrawal
        </Button>
      )}
      {error && <p className="w-full text-right text-sm text-red-600">{error}</p>}
    </Card>
  );
}
