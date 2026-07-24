import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  Copy,
  Loader2,
  MessagesSquare,
  Paperclip,
  Pencil,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  acceptBid,
  closeCall,
  deleteCall,
  duplicateCall,
  getCall,
  listBids,
  rejectBid,
  type Bid,
} from "../../../api/hiring";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Stars, formatResponse } from "../../../components/ui/Stars";
import { jobStatusMeta } from "../../../lib/jobStatus";
import { payLabel } from "./SellerHiring";

function initials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

function offerLabel(b: Bid): string {
  const amt = b.price_amount ? `€${Number(b.price_amount).toFixed(0)}` : null;
  const pct = b.percent ? `${Number(b.percent).toFixed(0)}%` : null;
  return [amt, pct].filter(Boolean).join(" + ") || "No price given";
}

export default function JobDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: call, isLoading } = useQuery({ queryKey: ["call", id], queryFn: () => getCall(id) });
  const { data: bids } = useQuery({ queryKey: ["bids", id], queryFn: () => listBids(id) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["call", id] });
    qc.invalidateQueries({ queryKey: ["bids", id] });
    qc.invalidateQueries({ queryKey: ["my-calls"] });
  };

  const accept = useMutation({ mutationFn: (bidId: string) => acceptBid(id, bidId), onSuccess: invalidate });
  const reject = useMutation({ mutationFn: (bidId: string) => rejectBid(id, bidId), onSuccess: invalidate });
  const close = useMutation({ mutationFn: () => closeCall(id), onSuccess: invalidate });
  const duplicate = useMutation({
    mutationFn: () => duplicateCall(id),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["my-calls"] });
      navigate(`/seller/hiring/${c.id}/edit`);
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteCall(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-calls"] });
      navigate("/seller/hiring");
    },
  });

  if (isLoading || !call) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const meta = jobStatusMeta(call.display_status);
  const refs = call.attachments.filter((a) => a.kind === "REFERENCE");
  const brand = call.attachments.filter((a) => a.kind === "BRAND_GUIDELINE");
  const canAccept = call.display_status === "OPEN" || call.display_status === "IN_REVIEW";

  return (
    <div>
      <Link to="/seller/hiring" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back to job offers
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{call.title}</h1>
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {call.base_name} · published {date(call.published_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {call.collaboration_id && (
            <Link to={`/collaborations/${call.collaboration_id}`}>
              <Button size="sm">
                <MessagesSquare className="h-4 w-4" /> Open collaboration
              </Button>
            </Link>
          )}
          {call.editable && (
            <Link to={`/seller/hiring/${call.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
            <Copy className="h-4 w-4" /> Duplicate
          </Button>
          {call.status !== "DRAFT" && call.status !== "CLOSED" && (
            <Button variant="ghost" size="sm" onClick={() => close.mutate()} disabled={close.isPending}>
              <XCircle className="h-4 w-4" /> Close
            </Button>
          )}
          {call.can_delete && (
            <Button variant="ghost" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending} title="Delete draft">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Applications */}
          <Card className="p-6">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <Users className="h-4 w-4 text-brand-600" /> Applications ({bids?.length ?? 0})
            </h2>

            {!bids?.length ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                No applications yet. Designers will appear here once they apply.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {bids.map((b) => (
                  <li
                    key={b.id}
                    className={`rounded-xl border p-4 ${
                      b.status === "ACCEPTED"
                        ? "border-emerald-300 bg-emerald-50/40"
                        : b.status === "REJECTED"
                          ? "border-slate-200 opacity-60"
                          : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <Link
                          to={`/designers/${b.designer.slug}`}
                          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
                        >
                          {b.designer.avatar_url ? (
                            <img src={b.designer.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            initials(b.designer.display_name)
                          )}
                        </Link>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link to={`/designers/${b.designer.slug}`} className="font-medium text-slate-900 hover:underline">
                              {b.designer.display_name}
                            </Link>
                            {b.status === "ACCEPTED" && <Badge tone="green">Accepted</Badge>}
                            {b.status === "REJECTED" && <Badge tone="slate">Not selected</Badge>}
                          </div>

                          {/* Social proof */}
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <Stars value={b.designer.rating_avg} count={b.designer.rating_count} />
                            {b.designer.completed_jobs > 0 && (
                              <span className="text-xs text-slate-400">{b.designer.completed_jobs} jobs done</span>
                            )}
                            {formatResponse(b.designer.response_hours) && (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                <Clock className="h-3 w-3" /> replies {formatResponse(b.designer.response_hours)}
                              </span>
                            )}
                          </div>

                          {b.designer.bio && <p className="mt-1 text-xs text-slate-400">{b.designer.bio}</p>}
                          <p className="mt-2 text-sm text-slate-600">{b.message}</p>

                          {/* Previous work */}
                          {b.designer.portfolio_preview.length > 0 && (
                            <div className="mt-3 flex items-center gap-2">
                              {b.designer.portfolio_preview.map((url) => (
                                <img key={url} src={url} alt="" className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
                              ))}
                              <Link to={`/designers/${b.designer.slug}`} className="text-xs font-medium text-brand-600 hover:underline">
                                View portfolio
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold text-brand-700">{offerLabel(b)}</p>
                        <p className="text-xs text-slate-400">{date(b.created_at)}</p>
                        {canAccept && b.status === "PENDING" && (
                          <div className="mt-2 flex justify-end gap-2">
                            <Button size="sm" onClick={() => accept.mutate(b.id)} disabled={accept.isPending || reject.isPending}>
                              <Check className="h-4 w-4" /> Accept
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => reject.mutate(b.id)}
                              disabled={accept.isPending || reject.isPending}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Brief */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">The brief</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{call.brief}</p>
            {call.design_style && (
              <p className="mt-3 text-sm text-slate-500">
                <span className="font-medium text-slate-700">Style:</span> {call.design_style}
              </p>
            )}
            {call.inspiration_notes && (
              <p className="mt-1 text-sm text-slate-500">
                <span className="font-medium text-slate-700">Inspiration:</span> {call.inspiration_notes}
              </p>
            )}

            {(refs.length > 0 || brand.length > 0) && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {refs.map((a) => (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                    <img src={a.url} alt="" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                  </a>
                ))}
                {brand.map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
                  >
                    <Paperclip className="h-4 w-4" /> Brand guidelines
                  </a>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Product + terms */}
        <div>
          <Card className="overflow-hidden">
            <div className="aspect-square bg-slate-100">
              {call.base_image_url && <img src={call.base_image_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Product</p>
              <p className="mt-1 font-medium text-slate-900">{call.base_name}</p>
              {call.provider && <p className="text-sm text-slate-500">by {call.provider}</p>}

              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Compensation</dt>
                  <dd className="font-medium text-slate-800">{payLabel(call)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Published</dt>
                  <dd className="font-medium text-slate-800">{date(call.published_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Deadline</dt>
                  <dd className="inline-flex items-center gap-1 font-medium text-slate-800">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-400" /> {date(call.deadline)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Desired launch</dt>
                  <dd className="font-medium text-slate-800">{date(call.desired_launch_date)}</dd>
                </div>
              </dl>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
