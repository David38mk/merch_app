import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import {
  deleteReview,
  getProductReviews,
  getReviewEligibility,
  reportReview,
  submitReview,
  uploadReviewPhoto,
  type Review,
} from "../../api/reviews";
import { useAuth } from "../../auth";
import { apiError } from "../../lib/apiError";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Stars, StarInput } from "./Stars";

const MIN_BODY = 20;
const MAX_PHOTOS = 5;

export function ReviewsSection({ productId }: { productId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: () => getProductReviews(productId),
  });
  const { data: elig } = useQuery({
    queryKey: ["review-eligibility", productId],
    queryFn: () => getReviewEligibility(productId),
    enabled: !!user,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["product-reviews", productId] });
    qc.invalidateQueries({ queryKey: ["review-eligibility", productId] });
    qc.invalidateQueries({ queryKey: ["product", productId] }); // header rating
  };

  const summary = data?.summary;

  return (
    <div className="mt-14">
      <h2 className="mb-5 text-xl font-bold text-slate-900">Ratings & reviews</h2>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary + breakdown */}
          {summary && summary.count > 0 ? (
            <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="text-center">
                <p className="text-4xl font-bold text-slate-900">{summary.average.toFixed(1)}</p>
                <Stars value={summary.average} size={18} className="mt-1 justify-center" />
                <p className="mt-1 text-sm text-slate-500">
                  {summary.count} review{summary.count === 1 ? "" : "s"}
                </p>
              </div>
              <div className="space-y-1.5">
                {[5, 4, 3, 2, 1].map((n) => {
                  const c = summary.breakdown[String(n)] ?? 0;
                  const pct = summary.count ? (c / summary.count) * 100 : 0;
                  return (
                    <div key={n} className="flex items-center gap-2 text-sm">
                      <span className="w-3 text-slate-500">{n}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-slate-400">{c}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No reviews yet — be the first to review this product.</p>
          )}

          {/* Customer photos strip */}
          {data && data.photos.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-slate-700">Customer photos</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {data.photos.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    loading="lazy"
                    className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Write-a-review area */}
          <div className="mt-8">
            {!user ? (
              <Card className="p-5 text-sm text-slate-600">
                <Link to={`/login?next=/p/${productId}`} className="font-medium text-brand-700 hover:underline">
                  Log in
                </Link>{" "}
                to review a product you've received.
              </Card>
            ) : elig?.has_review ? (
              <Card className="p-5">
                <p className="mb-3 text-sm font-medium text-slate-700">Your review</p>
                {elig.review && (
                  <ReviewCard
                    review={{ ...elig.review, mine: true, can_report: false }}
                    onDeleted={invalidate}
                    onReported={invalidate}
                  />
                )}
              </Card>
            ) : elig?.can_review ? (
              <ReviewForm productId={productId} onSubmitted={invalidate} />
            ) : elig ? (
              <Card className="p-5 text-sm text-slate-500">{elig.reason}</Card>
            ) : null}
          </div>

          {/* Review list (author's own is shown above; skip the dup here) */}
          {data && data.items.length > 0 && (
            <ul className="mt-8 space-y-5">
              {data.items
                .filter((r) => !(elig?.has_review && r.mine))
                .map((r) => (
                  <li key={r.id}>
                    <ReviewCard review={r} onDeleted={invalidate} onReported={invalidate} />
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function ReviewCard({
  review,
  onDeleted,
  onReported,
}: {
  review: Review;
  onDeleted: () => void;
  onReported: () => void;
}) {
  const del = useMutation({ mutationFn: () => deleteReview(review.id), onSuccess: onDeleted });
  const report = useMutation({
    mutationFn: () => reportReview(review.id),
    onSuccess: (r) => {
      onReported();
      window.alert(r.hidden ? "Thanks — this review has been hidden pending review." : "Thanks — this review has been reported.");
    },
    onError: (e) => window.alert(apiError(e, "Couldn't report that review.")),
  });

  return (
    <div className="border-b border-slate-100 pb-5 last:border-0">
      <div className="flex items-center justify-between">
        <Stars value={review.rating} />
        <span className="text-xs text-slate-400">{new Date(review.created_at).toLocaleDateString()}</span>
      </div>
      <p className="mt-1.5 font-semibold text-slate-900">{review.title}</p>
      <p className="mt-1 text-sm text-slate-500">by {review.reviewer_name}</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{review.body}</p>
      {review.photos.length > 0 && (
        <div className="mt-3 flex gap-2">
          {review.photos.map((src, i) => (
            <img key={i} src={src} alt="" loading="lazy" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-4">
        {review.mine && (
          <button
            onClick={() => window.confirm("Delete your review?") && del.mutate()}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        )}
        {review.can_report && (
          <button
            onClick={() => window.confirm("Report this review as inappropriate?") && report.mutate()}
            disabled={report.isPending}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-amber-600"
          >
            <Flag className="h-3.5 w-3.5" /> Report
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewForm({ productId, onSubmitted }: { productId: string; onSubmitted: () => void }) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () => submitReview({ shop_item_id: productId, rating, title: title.trim(), body: body.trim(), photo_urls: photos }),
    onSuccess: () => {
      setRating(0);
      setTitle("");
      setBody("");
      setPhotos([]);
      setError(null);
      onSubmitted();
    },
    onError: (e) => setError(apiError(e, "Couldn't submit your review.")),
  });

  const onPick = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
        const url = await uploadReviewPhoto(f);
        setPhotos((p) => [...p, url]);
      }
    } catch (e) {
      setError(apiError(e, "Couldn't upload that photo."));
    } finally {
      setUploading(false);
    }
  };

  const bodyOk = body.trim().length >= MIN_BODY;
  const canSubmit = rating >= 1 && title.trim() && bodyOk && !submit.isPending && !uploading;

  const doSubmit = () => {
    if (rating < 1) return setError("Please pick a star rating.");
    if (!title.trim()) return setError("Please add a title.");
    if (!bodyOk) return setError(`Your review must be at least ${MIN_BODY} characters.`);
    submit.mutate();
  };

  return (
    <Card className="p-5">
      <p className="mb-3 font-semibold text-slate-900">Write a review</p>

      <label className="label">Your rating</label>
      <StarInput value={rating} onChange={setRating} />

      <label className="label mt-4">Title</label>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sum it up in a few words" maxLength={120} />

      <label className="label mt-4">Your review</label>
      <textarea
        className="input min-h-[96px]"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What did you like or dislike? How's the fit, print and quality?"
      />
      <p className={`mt-1 text-xs ${bodyOk ? "text-slate-400" : "text-slate-500"}`}>
        {body.trim().length}/{MIN_BODY} characters minimum
      </p>

      {/* Photos */}
      <div className="mt-4">
        <label className="label">Photos (optional)</label>
        <div className="flex flex-wrap items-center gap-2">
          {photos.map((src, i) => (
            <div key={i} className="relative h-16 w-16">
              <img src={src} alt="" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
              <button
                onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-slate-400">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
            </label>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5">
        <Button onClick={doSubmit} disabled={!canSubmit}>
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Publish review
        </Button>
      </div>
    </Card>
  );
}
