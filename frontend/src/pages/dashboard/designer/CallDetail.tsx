import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Check, Loader2, Paperclip, Send } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getCall, submitBid } from "../../../api/hiring";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { apiError } from "../../../lib/apiError";
import { payLabel } from "../seller/SellerHiring";

export default function CallDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const { data: call, isLoading, isError } = useQuery({ queryKey: ["call", id], queryFn: () => getCall(id) });

  const [price, setPrice] = useState<number | "">("");
  const [percent, setPercent] = useState<number | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const apply = useMutation({
    mutationFn: () =>
      submitBid(id, {
        price_amount: price === "" ? null : Number(price),
        percent: percent === "" ? null : Number(percent),
        message: message.trim(),
      }),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["call", id] });
      qc.invalidateQueries({ queryKey: ["marketplace"] });
    },
    onError: (e) => setError(apiError(e, "Couldn't submit your application.")),
  });

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
            Back to job calls
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
        <ArrowLeft className="h-4 w-4" /> Back to job calls
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

          {(refs.length > 0 || brand.length > 0) && (
            <Card className="p-6">
              <h2 className="font-semibold text-slate-900">Attachments</h2>
              {refs.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {refs.map((a) => (
                    <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                      <img src={a.url} alt="" className="h-24 w-24 rounded-lg border border-slate-200 object-cover" />
                    </a>
                  ))}
                </div>
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
                  <dt className="text-slate-500">Bids so far</dt>
                  <dd className="font-medium text-slate-800">{call.bids_count}</dd>
                </div>
              </dl>

              {/* Apply */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                {call.has_applied && !apply.isPending ? (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    <Check className="h-4 w-4" /> Application submitted — you can revise it below.
                  </div>
                ) : (
                  <p className="text-sm font-medium text-slate-700">Submit your application</p>
                )}

                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
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
                  </div>
                  <div>
                    <label className="label text-xs">Message</label>
                    <textarea
                      className="input min-h-20 resize-y"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Why you're a great fit, links to relevant work…"
                    />
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <Button
                    className="w-full"
                    onClick={() => apply.mutate()}
                    disabled={apply.isPending || !message.trim()}
                  >
                    {apply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {call.has_applied ? "Update application" : "Submit application"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
