import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  Clock,
  Dribbble,
  Globe,
  Images,
  Instagram,
  Loader2,
  MapPin,
  MessagesSquare,
  Palette,
  Pencil,
  Star,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getDesignerProfile, getMyDesignerProfile } from "../../api/designers";
import { useAuth } from "../../auth";
import { Brand } from "../../components/layout/Brand";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Stars, formatResponse } from "../../components/ui/Stars";

function initials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function href(v: string): string {
  return /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^@/, "")}`;
}

export default function DesignerProfile() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: d, isLoading, isError } = useQuery({
    queryKey: ["designer", slug],
    queryFn: () => getDesignerProfile(slug),
  });
  // Owner check — only for logged-in users (guests just view).
  const { data: mine } = useQuery({ queryKey: ["my-designer"], queryFn: getMyDesignerProfile, enabled: !!user });
  const isOwner = !!mine && mine.slug === slug;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (isError || !d) {
    return (
      <div className="mx-auto mt-24 max-w-md text-center">
        <h1 className="text-xl font-bold text-slate-900">Designer not found</h1>
        <Button variant="outline" size="sm" className="mt-6" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    );
  }

  const response = formatResponse(d.response_hours);
  const memberSince = new Date(d.member_since).toLocaleDateString(undefined, { year: "numeric", month: "long" });
  const contacts = [
    d.website && { icon: Globe, label: "Website", url: href(d.website) },
    d.behance && { label: "Behance", url: href(d.behance) },
    d.dribbble && { icon: Dribbble, label: "Dribbble", url: href(d.dribbble) },
    d.instagram && { icon: Instagram, label: "Instagram", url: href(d.instagram) },
  ].filter(Boolean) as { icon?: typeof Globe; label: string; url: string }[];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link to="/">
            <Brand />
          </Link>
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Header card */}
        <Card className="overflow-hidden">
          <div className="h-32 bg-gradient-to-br from-brand-100 to-brand-50">
            {d.cover_url && <img src={d.cover_url} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="px-6 pb-6">
            <div className="-mt-10 flex items-end justify-between gap-4">
              <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-brand-600 text-xl font-bold text-white">
                {d.avatar_url ? <img src={d.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(d.display_name)}
              </span>
              {isOwner ? (
                <Link to="/designer/onboarding">
                  <Button size="sm">
                    <Pencil className="h-4 w-4" /> Edit profile
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" disabled title="Chat ships with the collaboration workspace">
                  <MessagesSquare className="h-4 w-4" /> Start chat — soon
                </Button>
              )}
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{d.display_name}</h1>
                {d.experience && (
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">{d.experience}</span>
                )}
              </div>
              {d.bio && <p className="mt-1 max-w-2xl text-sm text-slate-600">{d.bio}</p>}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <Stars value={d.rating_avg} count={d.rating_count} size="md" />
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <Briefcase className="h-4 w-4 text-slate-400" /> {d.completed_jobs} completed job{d.completed_jobs === 1 ? "" : "s"}
              </span>
              {d.country && (
                <span className="inline-flex items-center gap-1.5 text-slate-500">
                  <MapPin className="h-4 w-4 text-slate-400" /> {d.country}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <CalendarDays className="h-4 w-4 text-slate-400" /> Member since {memberSince}
              </span>
              {response && (
                <span className="inline-flex items-center gap-1.5 text-slate-500">
                  <Clock className="h-4 w-4 text-slate-400" /> Replies {response}
                </span>
              )}
            </div>

            {/* Skills */}
            {d.skills.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {d.skills.map((s) => (
                  <span key={s} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
                    {s}
                  </span>
                ))}
              </div>
            )}

            {/* Contact */}
            {contacts.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {contacts.map((c) => (
                  <a
                    key={c.label}
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700"
                  >
                    {c.icon ? <c.icon className="h-4 w-4" /> : <span className="text-xs font-bold">Bē</span>}
                    {c.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Projects — the designer's showcase, sellers' main hiring signal */}
        {d.projects.length > 0 && (
          <div className="mt-6">
            <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
              <Images className="h-5 w-5 text-brand-600" /> Projects
            </h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {d.projects.map((pr) => (
                <Card key={pr.id} className="overflow-hidden">
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {pr.cover_url && <img src={pr.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    {pr.featured && (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        <Star className="h-3 w-3 fill-current" /> Featured
                      </span>
                    )}
                    {pr.images.length > 1 && (
                      <span className="absolute bottom-2 right-2 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {pr.images.length} images
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="truncate font-semibold text-slate-900">{pr.title}</h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {new Date(pr.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short" })}
                    </p>
                    {pr.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{pr.description}</p>}
                    {pr.categories.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {pr.categories.map((c) => (
                          <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

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
                      <img src={p.resource_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {d.portfolio_links.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {d.portfolio_links.map((l) => (
                    <a key={l} href={href(l)} target="_blank" rel="noreferrer" className="truncate text-sm text-brand-700 hover:underline">
                      {l}
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
      </main>
    </div>
  );
}
