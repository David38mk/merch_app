import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, Clock, Loader2, MessagesSquare, Palette } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getDesignerProfile } from "../../api/designers";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Stars, formatResponse } from "../../components/ui/Stars";

function initials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export default function DesignerProfile() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { data: d, isLoading, isError } = useQuery({
    queryKey: ["designer", slug],
    queryFn: () => getDesignerProfile(slug),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (isError || !d) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <h1 className="text-xl font-bold text-slate-900">Designer not found</h1>
        <Button variant="outline" size="sm" className="mt-6" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    );
  }

  const response = formatResponse(d.response_hours);

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header */}
      <Card className="overflow-hidden">
        <div className="h-28 bg-gradient-to-br from-brand-100 to-brand-50">
          {d.cover_url && <img src={d.cover_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="px-6 pb-6">
          <div className="-mt-9 flex items-end gap-4">
            <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-brand-600 text-xl font-bold text-white">
              {d.avatar_url ? <img src={d.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(d.display_name)}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{d.display_name}</h1>
              {d.bio && <p className="mt-1 max-w-xl text-sm text-slate-600">{d.bio}</p>}
            </div>
            <Button variant="outline" size="sm" disabled title="Chat ships with the collaboration workspace">
              <MessagesSquare className="h-4 w-4" /> Start chat — soon
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Stars value={d.rating_avg} count={d.rating_count} size="md" />
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <Briefcase className="h-4 w-4 text-slate-400" /> {d.completed_jobs} completed job
              {d.completed_jobs === 1 ? "" : "s"}
            </span>
            {response && (
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <Clock className="h-4 w-4 text-slate-400" /> Replies {response}
              </span>
            )}
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Portfolio */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <Palette className="h-4 w-4 text-brand-600" /> Portfolio
            </h2>
            {d.portfolio.length === 0 ? (
              <EmptyState icon={Palette} title="No work published yet" hint="This designer hasn't added any pieces." />
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {d.portfolio.map((p) => (
                  <a
                    key={p.id}
                    href={p.resource_url}
                    target="_blank"
                    rel="noreferrer"
                    className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-brand-300"
                  >
                    <img src={p.resource_url} alt="" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Reviews */}
        <div>
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Reviews ({d.rating_count})</h2>
            {d.reviews.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                No reviews yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {d.reviews.map((r) => (
                  <li key={r.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-800">{r.reviewer_name}</p>
                      <Stars value={r.rating} />
                    </div>
                    {r.comment && <p className="mt-1 text-sm text-slate-600">{r.comment}</p>}
                    <p className="mt-1 text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        <Link to="/seller/hiring" className="hover:underline">
          Back to your job offers
        </Link>
      </p>
    </div>
  );
}
