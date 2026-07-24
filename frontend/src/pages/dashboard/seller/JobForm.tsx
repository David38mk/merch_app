import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, ImagePlus, Loader2, Paperclip, Rocket, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import {
  createCall,
  deleteAttachment,
  getCall,
  updateCall,
  uploadAttachment,
  type AttachmentKind,
  type PaymentType,
} from "../../../api/hiring";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { apiError } from "../../../lib/apiError";
import { cn } from "../../../lib/cn";
import type { ProductConfig } from "../../../lib/productConfig";

const PAY_OPTIONS: { value: PaymentType; label: string }[] = [
  { value: "FIXED", label: "Fixed price" },
  { value: "PERCENT", label: "Revenue share" },
  { value: "BOTH", label: "Fixed + share" },
];

const toIso = (d: string) => (d ? new Date(`${d}T23:59:59`).toISOString() : null);
const fromIso = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");
const today = () => new Date().toISOString().slice(0, 10);

interface PendingFile {
  file: File;
  kind: AttachmentKind;
}

export default function JobForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const loc = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const config = (loc.state as { config?: ProductConfig } | null)?.config;

  const existing = useQuery({ queryKey: ["call", id], queryFn: () => getCall(id!), enabled: isEdit });

  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [style, setStyle] = useState("");
  const [notes, setNotes] = useState("");
  const [payType, setPayType] = useState<PaymentType>("FIXED");
  const [amount, setAmount] = useState<number | "">("");
  const [percent, setPercent] = useState<number | "">("");
  const [deadline, setDeadline] = useState("");
  const [launch, setLaunch] = useState("");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refInput = useRef<HTMLInputElement>(null);
  const brandInput = useRef<HTMLInputElement>(null);

  // Prefill when editing
  useEffect(() => {
    const c = existing.data;
    if (!c) return;
    setTitle(c.title);
    setBrief(c.brief);
    setStyle(c.design_style ?? "");
    setNotes(c.inspiration_notes ?? "");
    setPayType(c.payment_type);
    setAmount(c.budget_amount ? Number(c.budget_amount) : "");
    setPercent(c.revenue_share_percent ? Number(c.revenue_share_percent) : "");
    setDeadline(fromIso(c.deadline));
    setLaunch(fromIso(c.desired_launch_date));
  }, [existing.data]);

  const baseItemId = config?.base_item_id ?? existing.data?.base_item_id ?? null;
  const productName = config?.name ?? existing.data?.base_name ?? null;
  const productImage = config?.image_url ?? existing.data?.base_image_url ?? null;
  const provider = config?.provider ?? existing.data?.provider ?? null;

  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      const payload = {
        title: title.trim(),
        brief: brief.trim(),
        design_style: style.trim() || null,
        inspiration_notes: notes.trim() || null,
        payment_type: payType,
        budget_amount: amount === "" ? null : Number(amount),
        revenue_share_percent: percent === "" ? null : Number(percent),
        deadline: toIso(deadline),
        desired_launch_date: toIso(launch),
        publish,
      };
      if (isEdit) return updateCall(id!, payload);
      const created = await createCall({ ...payload, base_item_id: baseItemId! });
      // attachments need a call to hang off — upload them right after creation
      for (const p of pending) await uploadAttachment(created.id, p.file, p.kind);
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-calls"] });
      navigate("/seller/hiring");
    },
    onError: (e) => setError(apiError(e, "Couldn't save the job.")),
  });

  const attachNow = useMutation({
    mutationFn: ({ file, kind }: PendingFile) => uploadAttachment(id!, file, kind),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call", id] }),
    onError: (e) => setError(apiError(e, "Upload failed.")),
  });
  const detach = useMutation({
    mutationFn: (attId: string) => deleteAttachment(id!, attId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call", id] }),
  });

  function addFiles(files: FileList | null, kind: AttachmentKind) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files);
    if (isEdit) list.forEach((file) => attachNow.mutate({ file, kind }));
    else setPending((p) => [...p, ...list.map((file) => ({ file, kind }))]);
  }

  // validations
  const titleValid = title.trim().length > 0;
  const briefValid = brief.trim().length > 0;
  const amountValid = amount !== "" && Number(amount) > 0;
  const percentValid = percent !== "" && Number(percent) >= 1 && Number(percent) <= 50;
  const payValid =
    payType === "FIXED" ? amountValid : payType === "PERCENT" ? percentValid : amountValid && percentValid;
  const deadlineValid = !deadline || deadline >= today();
  const canDraft = titleValid && briefValid && deadlineValid && Boolean(baseItemId) && !save.isPending;
  const canPublish = canDraft && payValid;

  if (isEdit && existing.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!baseItemId) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <h1 className="text-xl font-bold text-slate-900">Pick a product first</h1>
        <p className="mt-2 text-sm text-slate-500">
          A job is always tied to a product, so designers know exactly what they're designing for.
        </p>
        <Link to="/seller/catalog" className="mt-6 inline-block">
          <Button variant="outline" size="sm">
            Browse catalog
          </Button>
        </Link>
      </div>
    );
  }

  const attachments = existing.data?.attachments ?? [];

  return (
    <div>
      <Link to="/seller/hiring" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back to job offers
      </Link>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          {/* Job details */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Job details</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="label">
                  Job title <span className="text-red-500">*</span>
                </label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Retro wave graphic for a tee" />
              </div>
              <div>
                <label className="label">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="input min-h-28 resize-y"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="What do you want designed? Colours, mood, audience, must-haves…"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Design style</label>
                  <input className="input" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Retro, minimal, hand-drawn…" />
                </div>
                <div>
                  <label className="label">Inspiration / notes</label>
                  <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Links or references" />
                </div>
              </div>
            </div>
          </Card>

          {/* Compensation */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Compensation</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {PAY_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setPayType(o.value)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                    payType === o.value
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(payType === "FIXED" || payType === "BOTH") && (
                <div>
                  <label className="label">Fixed price (€)</label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    className="input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="150"
                  />
                </div>
              )}
              {(payType === "PERCENT" || payType === "BOTH") && (
                <div>
                  <label className="label">Revenue share (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step="1"
                    className="input"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="10"
                  />
                  <p className="mt-1 text-xs text-slate-400">Between 1% and 50% of each sale.</p>
                </div>
              )}
            </div>
            {!payValid && (
              <p className="mt-2 text-xs text-amber-600">Add the payment details before publishing (drafts can wait).</p>
            )}
          </Card>

          {/* Timeline */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Timeline</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Deadline</label>
                <input type="date" min={today()} className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                {!deadlineValid && <p className="mt-1 text-xs text-red-600">Deadline can't be in the past.</p>}
              </div>
              <div>
                <label className="label">Desired launch date</label>
                <input type="date" className="input" value={launch} onChange={(e) => setLaunch(e.target.value)} />
              </div>
            </div>
          </Card>

          {/* Attachments */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Attachments</h2>
            <p className="mb-3 text-sm text-slate-500">Reference images help designers hit your vision faster.</p>

            <input ref={refInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files, "REFERENCE")} />
            <input ref={brandInput} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => addFiles(e.target.files, "BRAND_GUIDELINE")} />

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => refInput.current?.click()}>
                <ImagePlus className="h-4 w-4" /> Reference images
              </Button>
              <Button variant="outline" size="sm" onClick={() => brandInput.current?.click()}>
                <FileText className="h-4 w-4" /> Brand guidelines
              </Button>
              {attachNow.isPending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            </div>

            {(attachments.length > 0 || pending.length > 0) && (
              <div className="mt-4 flex flex-wrap gap-3">
                {attachments.map((a) => (
                  <div key={a.id} className="group relative">
                    {a.url.endsWith(".pdf") ? (
                      <a href={a.url} target="_blank" rel="noreferrer" className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border border-slate-200 text-slate-500">
                        <Paperclip className="h-5 w-5" />
                        <span className="mt-1 text-[10px]">PDF</span>
                      </a>
                    ) : (
                      <img src={a.url} alt="" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                    )}
                    <button
                      onClick={() => detach.mutate(a.id)}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-slate-400 shadow ring-1 ring-slate-200 hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {a.kind === "BRAND_GUIDELINE" && (
                      <span className="absolute bottom-1 left-1 rounded bg-white/90 px-1 text-[9px] text-slate-500">brand</span>
                    )}
                  </div>
                ))}
                {pending.map((p, i) => (
                  <div key={i} className="relative">
                    <div className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-1 text-center text-[10px] text-slate-500">
                      <Paperclip className="mb-1 h-4 w-4" />
                      <span className="line-clamp-2">{p.file.name}</span>
                    </div>
                    <button
                      onClick={() => setPending((prev) => prev.filter((_, x) => x !== i))}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-slate-400 shadow ring-1 ring-slate-200 hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!isEdit && pending.length > 0 && (
              <p className="mt-2 text-xs text-slate-400">Files upload when you save the job.</p>
            )}
          </Card>
        </div>

        {/* Product + actions */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="aspect-square bg-slate-100">
              {productImage && <img src={productImage} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Selected product</p>
              <p className="mt-1 font-medium text-slate-900">{productName}</p>
              {provider && <p className="text-sm text-slate-500">by {provider}</p>}
              {existing.data && (
                <div className="mt-3">
                  <Badge tone={existing.data.status === "OPEN" ? "green" : "slate"}>
                    {existing.data.status === "OPEN" ? "Published" : existing.data.status}
                  </Badge>
                </div>
              )}

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              <div className="mt-5 space-y-2">
                <Button className="w-full" onClick={() => save.mutate(true)} disabled={!canPublish}>
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  {isEdit && existing.data?.status === "OPEN" ? "Save & keep published" : "Publish job"}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => save.mutate(false)} disabled={!canDraft}>
                  <Save className="h-4 w-4" /> Save as draft
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
