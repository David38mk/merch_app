import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Palette, Sparkles, Store } from "lucide-react";
import { Link } from "react-router-dom";

import { getMarketplaceHome, type BrandCard } from "../api/marketplace";
import { ProductTile } from "../components/marketplace/ProductTile";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { categoryIcon } from "../lib/categoryIcon";

export default function Landing() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["marketplace-home"], queryFn: getMarketplaceHome });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="text-sm text-red-600">Could not reach the marketplace — is the backend running on :8001?</p>
      </div>
    );
  }

  const { hero, categories, featured_products, trending_brands, new_arrivals } = data;
  const empty = featured_products.length === 0 && new_arrivals.length === 0;

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-brand-50/70 to-slate-50">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <Badge>
              <Sparkles className="h-3.5 w-3.5" /> Creator marketplace
            </Badge>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              {hero.headline}
            </h1>
            <p className="mt-5 max-w-lg text-lg text-slate-500">{hero.subtext}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={hero.cta_href}>
                <Button>
                  {hero.cta_label} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/sell">
                <Button variant="outline">
                  <Store className="h-4 w-4" /> Start selling
                </Button>
              </Link>
            </div>
          </div>

          {/* Featured brand + product preview */}
          {hero.brand && (
            <Link to={`/store/${hero.brand.slug}`} className="group block">
              <Card className="overflow-hidden shadow-pop">
                <div className="relative h-40 bg-gradient-to-br from-brand-100 to-slate-200">
                  {hero.brand.cover_url && (
                    <img src={hero.brand.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute left-4 top-4">
                    <Badge tone="brand">Featured brand</Badge>
                  </span>
                </div>
                <div className="flex items-center gap-3 p-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-700">
                    {hero.brand.logo_url ? (
                      <img src={hero.brand.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      hero.brand.name[0]?.toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{hero.brand.name}</p>
                    <p className="text-xs text-slate-400">{hero.brand.product_count} products</p>
                  </div>
                  <ArrowRight className="ml-auto h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                </div>
              </Card>
            </Link>
          )}
        </div>
      </section>

      {empty ? (
        <section className="mx-auto max-w-6xl px-6 py-24 text-center">
          <h2 className="text-xl font-bold text-slate-900">The marketplace is just getting started</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            No published products yet. Be the first creator to open a store.
          </p>
          <Link to="/sell" className="mt-6 inline-block">
            <Button>Start selling</Button>
          </Link>
        </section>
      ) : (
        <>
          {/* ── Categories ─────────────────────────────────────── */}
          {categories.length > 0 && (
            <Section title="Shop by category">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {categories.map((c) => {
                  const Icon = categoryIcon(c.name);
                  return (
                    <Link key={c.slug} to={`/marketplace?category=${encodeURIComponent(c.name)}`}>
                      <Card className="flex items-center gap-3 p-4 transition hover:shadow-pop">
                        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-medium text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-400">{c.count} items</p>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ── Featured products ──────────────────────────────── */}
          {featured_products.length > 0 && (
            <Section title="Featured products" href="/marketplace">
              <ProductGrid items={featured_products} />
            </Section>
          )}

          {/* ── Trending brands ────────────────────────────────── */}
          {trending_brands.length > 0 && (
            <Section title="Trending brands">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {trending_brands.map((b) => (
                  <BrandTile key={b.slug} b={b} />
                ))}
              </div>
            </Section>
          )}

          {/* ── New arrivals ───────────────────────────────────── */}
          {new_arrivals.length > 0 && (
            <Section title="New arrivals" href="/marketplace?sort=newest">
              <ProductGrid items={new_arrivals} />
            </Section>
          )}
        </>
      )}

      {/* ── Creator CTA strip ────────────────────────────────── */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-12 sm:flex-row">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Have an audience? Turn it into a brand.</h2>
            <p className="text-sm text-slate-500">Design merch with AI or hire a designer — we print and ship.</p>
          </div>
          <Link to="/sell">
            <Button>
              <Store className="h-4 w-4" /> Start selling
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Designer CTA strip ───────────────────────────────── */}
      <section className="border-t border-slate-200 bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-12 sm:flex-row">
          <div>
            <h2 className="text-lg font-bold text-white">Are you a designer?</h2>
            <p className="text-sm text-slate-300">
              Find paid opportunities, collaborate with brands, and build your reputation.
            </p>
          </div>
          <Link to="/join-as-designer">
            <Button variant="outline" className="border-white/30 bg-white text-slate-900 hover:bg-slate-100">
              <Palette className="h-4 w-4" /> Become a designer
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-5 flex items-end justify-between">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        {href && (
          <Link to={href} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function ProductGrid({ items }: { items: React.ComponentProps<typeof ProductTile>["p"][] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((p) => (
        <ProductTile key={p.id} p={p} />
      ))}
    </div>
  );
}

function BrandTile({ b }: { b: BrandCard }) {
  return (
    <Link to={`/store/${b.slug}`} className="group block">
      <Card className="overflow-hidden transition hover:shadow-pop">
        <div className="grid grid-cols-3 gap-0.5 bg-slate-100">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-square overflow-hidden bg-slate-100">
              {b.sample_images[i] && (
                <img src={b.sample_images[i]} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-700">
            {b.logo_url ? (
              <img src={b.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              b.name[0]?.toUpperCase()
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{b.name}</p>
            <p className="text-xs text-slate-400">{b.product_count} products</p>
          </div>
          <ArrowRight className="ml-auto h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
        </div>
      </Card>
    </Link>
  );
}
