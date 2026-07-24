import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Copy, Eye, Loader2, Pencil, Plus, Rocket, Trash2, Users, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  closeCall,
  deleteCall,
  duplicateCall,
  listMyCalls,
  updateCall,
  type DesignerCall,
  type JobStatus,
} from "../../../api/hiring";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { cn } from "../../../lib/cn";
import { JOB_STATUSES, jobStatusMeta } from "../../../lib/jobStatus";

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

export function payLabel(c: DesignerCall): string {
  const amt = c.budget_amount ? `€${Number(c.budget_amount).toFixed(0)}` : "—";
  const pct = c.revenue_share_percent ? `${Number(c.revenue_share_percent).toFixed(0)}%` : "—";
  if (c.payment_type === "FIXED") return amt;
  if (c.payment_type === "PERCENT") return `${pct} revenue share`;
  return `${amt} + ${pct}`;
}

export default function SellerHiring() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<JobStatus | "ALL">("ALL");
  const { data, isLoading } = useQuery({ queryKey: ["my-calls"], queryFn: listMyCalls });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-calls"] });
  const publish = useMutation({ mutationFn: (id: string) => updateCall(id, { publish: true }), onSuccess: invalidate });
  const close = useMutation({ mutationFn: closeCall, onSuccess: invalidate });
  const remove = useMutation({ mutationFn: deleteCall, onSuccess: invalidate });
  const duplicate = useMutation({
    mutationFn: duplicateCall,
    onSuccess: (c) => {
      invalidate();
      navigate(`/seller/hiring/${c.id}/edit`);
    },
  });

  const all = data ?? [];
  const items = filter === "ALL" ? all : all.filter((c) => c.display_status === filter);
  const countFor = (s: JobStatus) => all.filter((c) => c.display_status === s).length;

  return (
    <div>
      <PageHeader
        title="My job offers"
        subtitle="Every design request you've created — track applications and hire designers."
        actions={
          <Link to="/seller/catalog">
            <Button>
              <Plus className="h-4 w-4" /> Post a job
            </Button>
          </Link>
        }
      />

      {/* Status filters */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter("ALL")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition",
            filter === "ALL" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
          )}
        >
          All {all.length > 0 && <span className="text-slate-400">{all.length}</span>}
        </button>
        {JOB_STATUSES.filter((s) => countFor(s) > 0).map((s) => {
          const meta = jobStatusMeta(s);
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                filter === s ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {meta.label} <span className="text-slate-400">{countFor(s)}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={Users}
            title="No jobs here"
            hint="Pick a product from the catalog, then hire a designer to create the artwork."
            action={
              <Link to="/seller/catalog">
                <Button size="sm">
                  <Plus className="h-4 w-4" /> Browse catalog
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const meta = jobStatusMeta(c.display_status);
            return (
              <Card key={c.id} className="flex flex-wrap items-center gap-4 p-4">
                <Link to={`/seller/hiring/${c.id}`} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {c.base_image_url && <img src={c.base_image_url} alt="" className="h-full w-full object-cover" />}
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/seller/hiring/${c.id}`} className="truncate font-medium text-slate-900 hover:underline">
                      {c.title}
                    </Link>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-slate-500">
                    {c.base_name} · {payLabel(c)}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
                    <span>
                      {c.bids_count} application{c.bids_count === 1 ? "" : "s"}
                    </span>
                    <span>Published {date(c.published_at)}</span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> {date(c.deadline)}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/seller/hiring/${c.id}`}>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4" /> View
                    </Button>
                  </Link>
                  {c.editable && (
                    <Link to={`/seller/hiring/${c.id}/edit`}>
                      <Button variant="ghost" size="sm" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                  {c.display_status === "DRAFT" && (
                    <Button size="sm" onClick={() => publish.mutate(c.id)} disabled={publish.isPending}>
                      <Rocket className="h-4 w-4" /> Publish
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => duplicate.mutate(c.id)} disabled={duplicate.isPending} title="Duplicate">
                    <Copy className="h-4 w-4" />
                  </Button>
                  {c.status !== "DRAFT" && c.status !== "CLOSED" && (
                    <Button variant="ghost" size="sm" onClick={() => close.mutate(c.id)} disabled={close.isPending} title="Close job">
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                  {c.can_delete && (
                    <Button variant="ghost" size="sm" onClick={() => remove.mutate(c.id)} disabled={remove.isPending} title="Delete draft">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
