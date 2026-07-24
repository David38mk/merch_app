import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import {
  getMarketplaceFacets,
  getMarketplaceProducts,
  type Facets,
  type ProductQuery,
} from "../api/marketplace";
import { ProductTile } from "../components/marketplace/ProductTile";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { cn } from "../lib/cn";
import { colorHex, isLightColor } from "../lib/colorHex";

const PAGE = 24;

const SORTS: { value: NonNullable<ProductQuery["sort"]>; label: string }[] = [
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

export default function Marketplace() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "";
  const sort = (params.get("sort") as ProductQuery["sort"]) ?? "popular";
  const q = params.get("q") ?? "";
  const brands = params.getAll("brand");
  const colors = params.getAll("color");
  const sizes = params.getAll("size");
  const priceMin = params.get("price_min") ?? "";
  const priceMax = params.get("price_max") ?? "";

  const [search, setSearch] = useState(q);
  const [lo, setLo] = useState(priceMin);
  const [hi, setHi] = useState(priceMax);
  const [limit, setLimit] = useState(PAGE);
  const [mobileFilters, setMobileFilters] = useState(false);

  // Debounce free-text inputs into the URL (which drives the query).
  useEffect(() => {
    const t = setTimeout(() => setParam("q", search.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  useEffect(() => {
    const t = setTimeout(() => {
      setParam("price_min", lo);
      setParam("price_max", hi);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lo, hi]);

  // Keep local inputs in step when the URL changes externally (e.g. Clear all).
  useEffect(() => setLo(priceMin), [priceMin]);
  useEffect(() => setHi(priceMax), [priceMax]);

  const filterSig = [category, sort, q, brands.join(), colors.join(), sizes.join(), priceMin, priceMax].join("|");
  useEffect(() => setLimit(PAGE), [filterSig]);

  const { data: facets } = useQuery({ queryKey: ["marketplace-facets"], queryFn: getMarketplaceFacets });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["marketplace-products", filterSig, limit],
    queryFn: () =>
      getMarketplaceProducts({
        category: category || undefined,
        q: q || undefined,
        sort,
        brand: brands.length ? brands : undefined,
        color: colors.length ? colors : undefined,
        size: sizes.length ? sizes : undefined,
        price_min: priceMin ? Number(priceMin) : undefined,
        price_max: priceMax ? Number(priceMax) : undefined,
        limit,
      }),
    placeholderData: keepPreviousData,
  });

  function setParam(key: string, value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }
  function toggleMulti(key: string, value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      const cur = next.getAll(key);
      next.delete(key);
      (cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]).forEach((v) => next.append(key, v));
      return next;
    });
  }
  function clearAll() {
    setSearch("");
    setLo("");
    setHi("");
    setParams(new URLSearchParams());
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const activeCount =
    (category ? 1 : 0) + brands.length + colors.length + sizes.length + (priceMin ? 1 : 0) + (priceMax ? 1 : 0);

  const sidebar = facets && (
    <FilterRail
      facets={facets}
      category={category}
      brands={brands}
      colors={colors}
      sizes={sizes}
      lo={lo}
      hi={hi}
      hasActive={activeCount > 0}
      onCategory={(name) => setParam("category", category === name ? "" : name)}
      onToggle={toggleMulti}
      onLo={setLo}
      onHi={setHi}
      onClear={clearAll}
    />
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">{category || "All products"}</h1>
        {data && <span className="text-sm text-slate-400">{total} items</span>}
      </div>

      {/* Search + sort */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search products, brands, keywords…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          className="lg:hidden"
          onClick={() => setMobileFilters(true)}
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="hidden h-4 w-4 text-slate-400 sm:block" />
          <select className="input" value={sort} onChange={(e) => setParam("sort", e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">{sidebar}</aside>

        {/* Results */}
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="text-sm text-slate-500">
                No products match your filters{q ? ` and "${q}"` : ""}.
              </p>
              {activeCount > 0 && (
                <Button variant="outline" size="sm" className="mt-4" onClick={clearAll}>
                  Clear filters
                </Button>
              )}
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {items.map((p) => (
                  <ProductTile key={p.id} p={p} />
                ))}
              </div>
              {items.length < total && (
                <div className="mt-8 text-center">
                  <Button variant="outline" onClick={() => setLimit((n) => n + PAGE)} disabled={isFetching}>
                    {isFetching && <Loader2 className="h-4 w-4 animate-spin" />} Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {mobileFilters && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="flex-1 bg-slate-900/40" onClick={() => setMobileFilters(false)} />
          <div className="w-80 max-w-[85vw] overflow-y-auto bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-slate-900">Filters</p>
              <button onClick={() => setMobileFilters(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebar}
            <Button className="mt-4 w-full" onClick={() => setMobileFilters(false)}>
              Show {total} results
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterRail({
  facets,
  category,
  brands,
  colors,
  sizes,
  lo,
  hi,
  hasActive,
  onCategory,
  onToggle,
  onLo,
  onHi,
  onClear,
}: {
  facets: Facets;
  category: string;
  brands: string[];
  colors: string[];
  sizes: string[];
  lo: string;
  hi: string;
  hasActive: boolean;
  onCategory: (name: string) => void;
  onToggle: (key: string, value: string) => void;
  onLo: (v: string) => void;
  onHi: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between pb-1">
        <p className="font-semibold text-slate-900">Filters</p>
        {hasActive && (
          <button onClick={onClear} className="text-xs font-medium text-brand-600 hover:underline">
            Clear all
          </button>
        )}
      </div>

      {facets.categories.length > 0 && (
        <FSection title="Category">
          <div className="flex flex-wrap gap-1.5">
            {facets.categories.map((c) => (
              <Chip key={c.slug} active={category === c.name} onClick={() => onCategory(c.name)}>
                {c.name}
              </Chip>
            ))}
          </div>
        </FSection>
      )}

      <FSection title="Price (€)">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            className="input py-1.5"
            placeholder={String(Math.floor(facets.price_min))}
            value={lo}
            onChange={(e) => onLo(e.target.value)}
          />
          <span className="text-slate-400">–</span>
          <input
            type="number"
            min={0}
            className="input py-1.5"
            placeholder={String(Math.ceil(facets.price_max))}
            value={hi}
            onChange={(e) => onHi(e.target.value)}
          />
        </div>
      </FSection>

      {facets.colors.length > 0 && (
        <FSection title="Color">
          <div className="flex flex-wrap gap-2">
            {facets.colors.map((c) => (
              <button
                key={c}
                title={c}
                onClick={() => onToggle("color", c)}
                className={cn(
                  "h-7 w-7 rounded-full ring-2 ring-offset-2 transition",
                  colors.includes(c) ? "ring-brand-500" : "ring-transparent",
                  isLightColor(c) && "border border-slate-200",
                )}
                style={{ background: colorHex(c) }}
              />
            ))}
          </div>
        </FSection>
      )}

      {facets.sizes.length > 0 && (
        <FSection title="Size">
          <div className="flex flex-wrap gap-1.5">
            {facets.sizes.map((s) => (
              <Chip key={s} active={sizes.includes(s)} onClick={() => onToggle("size", s)}>
                {s}
              </Chip>
            ))}
          </div>
        </FSection>
      )}

      {facets.brands.length > 0 && (
        <FSection title="Brand">
          <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {facets.brands.map((b) => (
              <label key={b.slug} className="flex cursor-pointer items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  checked={brands.includes(b.slug)}
                  onChange={() => onToggle("brand", b.slug)}
                />
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                <span className="text-xs text-slate-400">{b.count}</span>
              </label>
            ))}
          </div>
        </FSection>
      )}
    </div>
  );
}

function FSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-4">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
      )}
    >
      {children}
    </button>
  );
}
