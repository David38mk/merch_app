import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Check, Loader2, Paperclip, Send, Store } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getCall, submitBid, type DesignerCall } from "../../../api/hiring";
import { getProjects, type DesignerProject } from "../../../api/designer";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { apiError } from "../../../lib/apiError";
import { cn } from "../../../lib/cn";
import { payLabel } from "../seller/SellerHiring";

const MAX_BID_PROJECTS = 6;

export default function CallDetail() {
  const { id = "" } = useParams();
  const { data: call, isLoading, isError } = useQuery({ queryKey: ["call", id], queryFn: () => getCall(id) });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (isError || !call) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <h1 className="text-xl font-bold text-slate-900">Job not found</h1>
        <p className="mt-2 text-sm text-slate-500">It may have been unpublished or removed.</p>
        <Link to="/designer" className="mt-6 inline-block">
          <Button variant="outline" size="sm">
            Back to jobs
          </Button>
        </Link>
      </div>
    );
  }

  const refs = call.attachments.filter((a) => a.kind === "REFERENCE");
  const brand = call.attachments.filter((a) => a.kind === "BRAND_GUIDELINE");

  return (
    <div>
      <Link to="/designer" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back to jobs
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{call.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {call.seller_brand ?? "A seller"} · for {call.base_name}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="brand">{payLabel(call)}</Badge>
              {call.base_category && <Badge tone="slate">{call.base_category}</Badge>}
              {call.design_style && <Badge tone="slate">{call.design_style}</Badge>}
            </div>

            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wider text-slate-400">The brief</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{call.brief}</p>

            {call.inspiration_notes && (
              <>
                <h2 className="mt-5 text-sm font-semibold uppercase tracking-wider text-slate-400">Inspiration</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{call.inspiration_notes}</p>
              </>
            )}
          </Card>

          {/* Brand information */}
          {call.seller_brand && (
            <Card className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {call.seller_logo ? (
                  <img src={call.seller_logo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Store className="h-5 w-5 text-slate-400" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Brand</p>
                <p className="truncate font-medium text-slate-900">{call.seller_brand}</p>
              </div>
              {call.seller_slug && (
                <Link to={`/store/${call.seller_slug}`}>
                  <Button variant="outline" size="sm">
                    <Store className="h-4 w-4" /> View store
                  </Button>
                </Link>
              )}
            </Card>
          )}

          {(refs.length > 0 || brand.length > 0) && (
            <Card className="p-6">
              <h2 className="font-semibold text-slate-900">Reference images</h2>
              {refs.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  {refs.map((a) => (
                    <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                      <img src={a.url} alt="" className="h-24 w-24 rounded-lg border border-slate-200 object-cover" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">No reference images.</p>
              )}
              {brand.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {brand.map((a) => (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline"
                    >
                      <Paperclip className="h-4 w-4" /> Brand guidelines
                    </a>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Product + apply */}
        <div className="space-y-5">
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
                  <dt className="text-slate-500">Payment model</dt>
                  <dd className="font-medium text-slate-800">{payLabel(call)}</dd>
                </div>
                {call.deadline && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Deadline</dt>
                    <dd className="inline-flex items-center gap-1 font-medium text-slate-800">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                      {new Date(call.deadline).toLocaleDateString()}
                    </dd>
                  </div>
                )}
                {call.desired_launch_date && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Desired launch</dt>
                    <dd className="font-medium text-slate-800">{new Date(call.desired_launch_date).toLocaleDateString()}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-slate-500">Applicants</dt>
                  <dd className="font-medium text-slate-800">{call.bids_count}</dd>
                </div>
              </dl>
            </div>
          </Card>

          <ApplyPanel call={call} />
        </div>
      </div>
    </div>
  );
}

function ApplyPanel({ call }: { call: DesignerCall }) {
  const qc = useQueryClient();
  const mine = call.my_bid;

  const [intro, setIntro] = useState(mine?.intro ?? "");
  const [message, setMessage] = useState(mine?.message ?? "");
  const [price, setPrice] = useState<number | "">(mine?.price_amount ? Number(mine.price_amount) : "");
  const [percent, setPercent] = useState<number | "">(mine?.percent ? Number(mine.percent) : "");
  const [selected, setSelected] = useState<Set<string>>(new Set(mine?.projects.map((p) => p.id) ?? []));
  const [error, setError] = useState<string | null>(null);

  const { data: projects } = useQuery({ queryKey: ["my-projects"], queryFn: getProjects });
  const published = (projects ?? []).filter((p: DesignerProject) => p.published);

  const showPrice = call.payment_type === "FIXED" || call.payment_type === "BOTH";
  const showPercent = call.payment_type === "PERCENT" || call.payment_type === "BOTH";

  const toggle = (pid: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(pid)) next.delete(pid);
      else if (next.size < MAX_BID_PROJECTS) next.add(pid);
      return next;
    });

  const apply = useMutation({
    mutationFn: () =>
      submitBid(call.id, {
        price_amount: showPrice && price !== "" ? Number(price) : null,
        percent: showPercent && percent !== "" ? Number(percent) : null,
        intro: intro.trim() || null,
        message: message.trim(),
        project_ids: [...selected],
      }),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["call", call.id] });
      qc.invalidateQueries({ queryKey: ["marketplace"] });
    },
    onError: (e) => setError(apiError(e, "Couldn't submit your application.")),
  });

  return (
    <Card className="p-5">
      {call.has_applied ? (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <Check className="h-4 w-4" /> Application submitted — you can revise it below.
        </div>
      ) : (
        <p className="mb-3 font-medium text-slate-800">Apply to this job</p>
      )}

      <div className="space-y-3">
        <div>
          <label className="label text-xs">Short introduction</label>
          <input
            className="input"
            maxLength={160}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="One line on why you fit — e.g. “Streetwear specialist, 5y”"
          />
        </div>

        <div>
          <label className="label text-xs">Cover message</label>
          <textarea
            className="input min-h-24 resize-y"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Introduce yourself, your approach to the brief, and relevant experience…"
          />
        </div>

        {(showPrice || showPercent) && (
          <div className="grid grid-cols-2 gap-2">
            {showPrice && (
              <div>
                <label className="label text-xs">Your price (€)</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="180"
                />
              </div>
            )}
            {showPercent && (
              <div>
                <label className="label text-xs">Revenue %</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  className="input"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="8"
                />
              </div>
            )}
          </div>
        )}

        {/* Portfolio selection */}
        <div>
          <label className="label text-xs">
            Attach portfolio {selected.size > 0 && <span className="text-slate-400">({selected.size}/{MAX_BID_PROJECTS})</span>}
          </label>
          {published.length === 0 ? (
            <p className="mt-1 rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-400">
              No published projects yet.{" "}
              <Link to="/designer/portfolio" className="font-medium text-brand-600 hover:underline">
                Add work to your portfolio
              </Link>{" "}
              to showcase it here.
            </p>
          ) : (
            <div className="mt-1 grid grid-cols-3 gap-2">
              {published.map((p) => {
                const on = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    title={p.title}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-lg border-2 transition",
                      on ? "border-brand-500" : "border-transparent hover:border-slate-200",
                    )}
                  >
                    {p.cover_url ? (
                      <img src={p.cover_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-slate-100 text-[10px] text-slate-400">
                        {p.title}
                      </span>
                    )}
                    {on && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" onClick={() => apply.mutate()} disabled={apply.isPending || !message.trim()}>
          {apply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {call.has_applied ? "Update application" : "Submit application"}
        </Button>
      </div>
    </Card>
  );
}
