import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Loader2, Package, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getCatalog, getFacets } from "../../../api/catalog";
import { CatalogFilters, type CatalogFilterValue } from "../../../components/catalog/CatalogFilters";
import { ProductCard } from "../../../components/catalog/ProductCard";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { cn } from "../../../lib/cn";
import { getRecentlyViewed } from "../../../lib/recentlyViewed";

type Sort = "newest" | "price_asc" | "price_desc" | "name";

const emptyFilters: CatalogFilterValue = { available_only: false, favorites_only: false };

const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
];

export default function SellerCatalog() {
  const [filters, setFilters] = useState<CatalogFilterValue>(emptyFilters);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [showFilters, setShowFilters] = useState(false);

  const recent = useMemo(() => getRecentlyViewed(), []);

  // Debounce search so filters "update instantly" without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: facets } = useQuery({ queryKey: ["catalog-facets"], queryFn: getFacets, staleTime: Infinity });

  const query = { ...filters, search: debounced, sort };
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ["catalog", query],
    queryFn: ({ pageParam }) => getCatalog({ ...query, page: pageParam, page_size: 12 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.page_size < last.total ? last.page + 1 : undefined),
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  function patch(p: Partial<CatalogFilterValue>) {
    setFilters((f) => ({ ...f, ...p }));
  }

  return (
    <div>
      <PageHeader
        title="Product catalog"
        subtitle="Browse blanks from our print partners, then pick one to customize or hire a designer for."
      />

      {/* Recently viewed */}
      {recent.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Recently viewed</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recent.map((r) => (
              <Link
                key={r.id}
                to={`/seller/catalog/${r.id}`}
                className="flex w-40 shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white hover:shadow-pop"
              >
                <div className="aspect-square bg-slate-100">
                  {r.image_url ? (
                    <img src={r.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300">
                      <Package className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-slate-800">{r.name}</p>
                  <p className="text-[11px] text-brand-700">from €{String(r.base_price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search products, categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <Button variant="outline" className="lg:hidden" onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Filters sidebar */}
        {facets && (
          <aside className={cn("w-64 shrink-0 lg:block", showFilters ? "block" : "hidden")}>
            <Card className="p-4">
              <CatalogFilters facets={facets} value={filters} onChange={patch} onClear={() => setFilters(emptyFilters)} />
            </Card>
          </aside>
        )}

        {/* Results */}
        <div className="min-w-0 flex-1">
          <p className="mb-3 text-sm text-slate-500">
            {isLoading ? "Loading…" : `${total} product${total === 1 ? "" : "s"}`}
            {isFetching && !isLoading && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
          </p>

          {isError ? (
            <Card className="p-6">
              <p className="text-sm text-red-600">Couldn't load the catalog — is the backend running on :8001?</p>
            </Card>
          ) : isLoading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="p-6">
              <EmptyState
                icon={Package}
                title="No products match"
                hint="Try clearing a filter or searching for something else."
              />
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                {items.map((item) => (
                  <ProductCard key={item.id} item={item} />
                ))}
              </div>
              {hasNextPage && (
                <div className="mt-6 flex justify-center">
                  <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                    {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
