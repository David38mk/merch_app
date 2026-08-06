import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CreditCard,
  Loader2,
  Package,
  PlayCircle,
  Send,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  approveSubmission,
  completePayment,
  getCollaboration,
  listMessages,
  postMessage,
  requestRevision,
  startWork,
  submitWork,
  type Collaboration,
  type SubmissionKind,
} from "../../api/collaborations";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { apiError } from "../../lib/apiError";
import { cn } from "../../lib/cn";
import { COLLAB_STEPS, eventLabel, stageMeta, stepStatuses } from "../../lib/collabStage";
import { timeAgo } from "../../lib/timeAgo";

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

export default function CollaborationWorkspace() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<SubmissionKind>("PREVIEW");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: collab, isLoading } = useQuery({
    queryKey: ["collab", id],
    queryFn: () => getCollaboration(id),
    refetchInterval: 15_000, // poll so the counterpart's actions (approve/revise/pay) reflect live
  });
  const { data: messages } = useQuery({
    queryKey: ["collab-messages", id],
    queryFn: () => listMessages(id),
    refetchInterval: 20_000, // polled — real-time chat is the deferred seam
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["collab", id] });
    qc.invalidateQueries({ queryKey: ["collabs"] });
    qc.invalidateQueries({ queryKey: ["shop-items"] });
  };
  const onErr = (e: unknown) => setError(apiError(e, "Something went wrong."));

  const start = useMutation({ mutationFn: () => startWork(id), onSuccess: refresh, onError: onErr });
  const upload = useMutation({
    mutationFn: (file: File) => submitWork(id, file, kind, note.trim() || undefined),
    onSuccess: () => {
      setNote("");
      refresh();
    },
    onError: onErr,
  });
  const approve = useMutation({
    mutationFn: (sid: string) => approveSubmission(id, sid),
    onSuccess: refresh,
    onError: onErr,
  });
  const revise = useMutation({
    mutationFn: (sid: string) => requestRevision(id, sid, feedback.trim()),
    onSuccess: () => {
      setFeedback("");
      setReviewing(null);
      refresh();
    },
    onError: onErr,
  });
  const pay = useMutation({ mutationFn: () => completePayment(id), onSuccess: refresh, onError: onErr });
  const send = useMutation({
    mutationFn: () => postMessage(id, draft.trim()),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["collab-messages", id] });
    },
    onError: onErr,
  });

  if (isLoading || !collab) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const meta = stageMeta(collab.stage);
  const isSeller = collab.my_role === "seller";
  const isDesigner = !isSeller;
  const counterpart = isSeller ? collab.designer : collab.seller;
  const canUpload = isDesigner && collab.stage !== "COMPLETED" && collab.stage !== "PAYMENT_PENDING";

  return (
    <div>
      <Link
        to={isSeller ? "/seller/hiring" : "/designer/collabs"}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {/* Overview */}
      <Card className="mb-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
              {collab.base_image_url && <img src={collab.base_image_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{collab.title}</h1>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {collab.base_name} · with <span className="font-medium text-slate-700">{counterpart.name}</span>
              </p>
              {collab.brief && <p className="mt-2 max-w-2xl text-sm text-slate-600">{collab.brief}</p>}
            </div>
          </div>

          <dl className="space-y-1 text-sm">
            <div className="flex gap-6">
              <dt className="text-slate-500">Deadline</dt>
              <dd className="ml-auto inline-flex items-center gap-1 font-medium text-slate-800">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" /> {date(collab.deadline)}
              </dd>
            </div>
            <div className="flex gap-6">
              <dt className="text-slate-500">Payment</dt>
              <dd className="ml-auto font-medium text-slate-800">
                {collab.agreed_price_amount ? `€${Number(collab.agreed_price_amount).toFixed(0)}` : ""}
                {collab.agreed_price_amount && collab.agreed_percent ? " + " : ""}
                {collab.agreed_percent ? `${Number(collab.agreed_percent).toFixed(0)}%` : ""}
                {!collab.agreed_price_amount && !collab.agreed_percent && "—"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Stage actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {isDesigner && collab.stage === "PENDING" && (
            <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending}>
              <PlayCircle className="h-4 w-4" /> Start working
            </Button>
          )}
          {isSeller && collab.stage === "PAYMENT_PENDING" && (
            <Button size="sm" onClick={() => pay.mutate()} disabled={pay.isPending}>
              {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Complete payment (€{Number(collab.agreed_price_amount ?? 0).toFixed(0)})
            </Button>
          )}
          {collab.shop_item_id && (
            <Link to="/seller/products">
              <Button variant="outline" size="sm">
                <Package className="h-4 w-4" /> View draft product
              </Button>
            </Link>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Card>

      <StatusTracker collab={collab} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Submissions */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Designs</h2>

            {collab.submissions.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                No designs submitted yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {collab.submissions.map((s) => (
                  <li key={s.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap gap-4">
                      {s.resource_url && (
                        <a href={s.resource_url} target="_blank" rel="noreferrer">
                          <img src={s.resource_url} alt="" className="h-24 w-24 rounded-lg border border-slate-200 object-cover" />
                        </a>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={s.kind === "FINAL" ? "brand" : "slate"}>
                            {s.kind === "FINAL" ? "Final files" : "Draft"}
                          </Badge>
                          {s.decision === "ACCEPTED" && <Badge tone="green">Approved</Badge>}
                          {s.decision === "DECLINED" && <Badge tone="amber">Revision requested</Badge>}
                          <span className="text-xs text-slate-400">{timeAgo(s.created_at)}</span>
                        </div>
                        {s.feedback && (
                          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            <span className="font-medium">Feedback:</span> {s.feedback}
                          </p>
                        )}

                        {isSeller && s.decision === "PENDING" && (
                          <div className="mt-3">
                            {reviewing === s.id ? (
                              <div className="space-y-2">
                                <textarea
                                  className="input min-h-16 resize-y"
                                  value={feedback}
                                  onChange={(e) => setFeedback(e.target.value)}
                                  placeholder="What should change?"
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => revise.mutate(s.id)} disabled={!feedback.trim() || revise.isPending}>
                                    Send feedback
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setReviewing(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => approve.mutate(s.id)} disabled={approve.isPending}>
                                  <Check className="h-4 w-4" /> Approve
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setReviewing(s.id)}>
                                  Request revision
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Designer upload */}
            {canUpload && (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-4">
                <p className="text-sm font-medium text-slate-700">Upload work</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(["PREVIEW", "FINAL"] as SubmissionKind[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setKind(k)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                        kind === k
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                      )}
                    >
                      {k === "PREVIEW" ? "Draft" : "Final files"}
                    </button>
                  ))}
                </div>
                <input
                  className="input mt-3"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note for the seller (optional)"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload.mutate(f);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                />
                <Button size="sm" className="mt-3" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
                  {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload {kind === "FINAL" ? "final files" : "draft"}
                </Button>
              </div>
            )}
          </Card>

          {/* Messages */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Messages</h2>
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
              {!messages?.length ? (
                <p className="py-6 text-center text-sm text-slate-400">No messages yet — say hello.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                        m.mine ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700",
                      )}
                    >
                      {!m.mine && <p className="mb-0.5 text-xs font-medium text-slate-500">{m.sender_name}</p>}
                      <p className="whitespace-pre-line">{m.body}</p>
                      <p className={cn("mt-1 text-[10px]", m.mine ? "text-white/70" : "text-slate-400")}>
                        {timeAgo(m.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                className="input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draft.trim()) send.mutate();
                }}
                placeholder="Write a message…"
              />
              <Button onClick={() => send.mutate()} disabled={!draft.trim() || send.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Timeline */}
        <div>
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Timeline</h2>
            <ol className="mt-4 space-y-4">
              {collab.events.map((e, i) => (
                <li key={e.id} className="relative flex gap-3 pb-1">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
                        i === collab.events.length - 1 ? "bg-brand-500 ring-4 ring-brand-100" : "bg-slate-300",
                      )}
                    />
                    {i < collab.events.length - 1 && <span className="mt-1 w-px flex-1 bg-slate-200" />}
                  </div>
                  <div className="min-w-0 pb-2">
                    <p className="text-sm font-medium text-slate-800">{eventLabel(e.type)}</p>
                    {e.note && <p className="mt-0.5 text-xs text-slate-500">{e.note}</p>}
                    <p className="mt-0.5 text-xs text-slate-400">
                      {e.actor_name ? `${e.actor_name} · ` : ""}
                      {timeAgo(e.created_at)}
                    </p>
                  </div>
                </li>
              ))}
              {collab.events.length === 0 && <p className="text-sm text-slate-400">Nothing has happened yet.</p>}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** The canonical 7-stage project timeline as a horizontal stepper. */
function StatusTracker({ collab }: { collab: Collaboration }) {
  const revisionHappened = collab.events.some((e) => e.type === "REVISION_REQUESTED");
  const statuses = stepStatuses(collab.stage, revisionHappened);

  return (
    <Card className="mb-6 overflow-x-auto p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Project status</h2>
      <ol className="flex min-w-max items-start gap-0">
        {COLLAB_STEPS.map((label, i) => {
          const st = statuses[i];
          const isLast = i === COLLAB_STEPS.length - 1;
          return (
            <li key={label} className="flex items-start">
              <div className="flex w-24 flex-col items-center text-center">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold",
                    st === "done" && "border-brand-600 bg-brand-600 text-white",
                    st === "current" && "border-brand-600 bg-white text-brand-700",
                    st === "upcoming" && "border-slate-200 bg-white text-slate-300",
                    st === "skipped" && "border-dashed border-slate-200 bg-white text-slate-300",
                  )}
                >
                  {st === "done" ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "mt-2 text-xs leading-tight",
                    st === "current" ? "font-semibold text-slate-800" : "text-slate-500",
                    st === "skipped" && "text-slate-300",
                  )}
                >
                  {label}
                </span>
                {st === "current" && <span className="mt-0.5 text-[10px] font-medium text-brand-600">In progress</span>}
                {st === "skipped" && <span className="mt-0.5 text-[10px] text-slate-300">Skipped</span>}
              </div>
              {!isLast && (
                <span
                  className={cn(
                    "mt-4 h-0.5 w-8 shrink-0",
                    statuses[i + 1] === "done" || st === "done" ? "bg-brand-500" : "bg-slate-200",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
