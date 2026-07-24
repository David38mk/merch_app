import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Copy,
  ExternalLink,
  EyeOff,
  Loader2,
  MessagesSquare,
  Package2,
  Pencil,
  Rocket,
  Search,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { listCollaborations } from "../../../api/collaborations";
import { getStorefront } from "../../../api/storefront";
import {
  deleteShopItem,
  duplicateShopItem,
  listShopItems,
  updateShopItem,
  type ProductSort,
  type ShopItem,
  type ShopItemState,
} from "../../../api/shopItems";
import { DesignPreviewThumb } from "../../../components/design/DesignPreviewThumb";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { apiError } from "../../../lib/apiError";
import { cn } from "../../../lib/cn";
import { stageMeta } from "../../../lib/collabStage";
import { PRODUCT_STATUS } from "../../../lib/productStatus";
import { timeAgo } from "../../../lib/timeAgo";

/** The collaboration tab isn't a ShopItem state — no product row exists until the
 * designer's work is approved — so it's its own tab key, sourced from /collaborations. */
type Tab = ShopItemState | "COLLAB";

const TABS: { key: Tab; label: string }[] = [
  { key: "UNLISTED", label: "Drafts" },
  { key: "LISTED", label: "Published" },
  { key: "COLLAB", label: "Collaborations" },
  { key: "ARCHIVED", label: "Archived" },
];

const SORTS: { value: ProductSort; label: string }[] = [
  { value: "updated_desc", label: "Last updated" },
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "name_asc", label: "Name A–Z" },
];

export default function SellerProducts() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("UNLISTED");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [sort, setSort] = useState<ProductSort>("updated_desc");
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ShopItem | null>(null);

  // Debounce the search — one request per pause, not per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const filters = {
    // The COLLAB tab shows live collaborations plus any legacy PENDING product
    // rows — so those are reachable instead of invisible in every tab.
    state: tab === "COLLAB" ? ("PENDING" as const) : tab,
    q: q.trim() || undefined,
    category: category || undefined,
    created_from: createdFrom || undefined,
    sort,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["shop-items", filters],
    queryFn: () => listShopItems(filters),
    // Keep the previous grid on screen while a filter change loads — no
    // full-page spinner flash on every keystroke.
    placeholderData: keepPreviousData,
  });
  const { data: collabs } = useQuery({ queryKey: ["collaborations"], queryFn: listCollaborations });
  const { data: store } = useQuery({ queryKey: ["storefront"], queryFn: getStorefront });

  // Only live work belongs in the tab — a finished collaboration has already
  // handed its draft product over to the Drafts tab.
  const activeCollabs = useMemo(
    () => (collabs ?? []).filter((c) => c.my_role === "seller" && c.stage !== "COMPLETED"),
    [collabs],
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["shop-items"] });
    qc.invalidateQueries({ queryKey: ["storefront"] });
  };
  const onError = (e: unknown) => setError(apiError(e, "That didn't work."));

  const setState = useMutation({
    mutationFn: ({ id, state }: { id: string; state: ShopItemState }) => updateShopItem(id, { state }),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError,
  });
  const duplicate = useMutation({ mutationFn: duplicateShopItem, onSuccess: refresh, onError });
  const remove = useMutation({
    mutationFn: deleteShopItem,
    onSuccess: () => {
      setConfirm(null);
      refresh();
    },
    onError,
  });

  const items = data?.items ?? [];
  const counts = data?.counts;
  const filtersOn = !!(qInput.trim() || category || createdFrom);
  // The PUBLISHED URL — config.slug can hold an unsaved draft slug that 404s.
  const storeUrl = store?.store_url ?? null;
  // Busy per card, not per grid — one card's mutation must not freeze the rest.
  const busyId = setState.isPending
    ? setState.variables?.id
    : duplicate.isPending
      ? duplicate.variables
      : null;

  function countFor(key: Tab): number {
    if (key === "COLLAB") return activeCollabs.length + (counts?.PENDING ?? 0);
    return counts?.[key] ?? 0;
  }

  return (
    <div>
      <PageHeader
        title="My products"
        subtitle="Every product you've made — draft, published, in collaboration or archived."
        actions={
          <Link to="/seller/catalog">
            <Button>
              <Wand2 className="h-4 w-4" /> New product
            </Button>
          </Link>
        }
      />

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 sm:inline-flex">
        {TABS.map((t) => {
          const count = countFor(t.key);
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-sm font-medium transition",
                tab === t.key ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {t.label}
              {count > 0 && (
                <span className={cn("ml-1.5", tab === t.key ? "text-white/75" : "text-slate-400")}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters — hidden on the collaboration tab, which isn't a product query */}
      {tab !== "COLLAB" && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search by name or tag…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />
          </div>
          <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {(data?.categories ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="input w-auto"
            title="Created on or after"
            value={createdFrom}
            onChange={(e) => setCreatedFrom(e.target.value)}
          />
          <select
            className="input w-auto"
            value={sort}
            onChange={(e) => setSort(e.target.value as ProductSort)}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {filtersOn && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQInput("");
                setQ("");
                setCategory("");
                setCreatedFrom("");
              }}
            >
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* ── Collaborations ─────────────────────────────────────────────── */}
      {tab === "COLLAB" ? (
        activeCollabs.length === 0 && items.length === 0 ? (
          <Card className="p-6">
            <EmptyState
              icon={MessagesSquare}
              title="No active collaborations"
              hint="Hire a designer and the work in progress shows up here until it becomes a product."
              action={
                <Link to="/seller/hiring">
                  <Button size="sm">Post a design job</Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* PENDING product rows (design still being made) — reachable here
                instead of being invisible in every tab. */}
            {items.map((it) => (
              <Card key={it.id} className="overflow-hidden">
                <DesignPreviewThumb
                  baseImageUrl={it.base_image_url}
                  designUrl={it.design_url}
                  pos_x={it.pos_x}
                  pos_y={it.pos_y}
                  scale={it.scale}
                  rotation={it.rotation}
                />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium text-slate-900">{it.name}</p>
                    <Badge tone="brand">In collaboration</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Design in progress — publish once it's approved.</p>
                  {it.collaboration_id ? (
                    <Link to={`/collaborations/${it.collaboration_id}`} className="mt-3 block">
                      <Button variant="outline" size="sm" className="w-full">
                        Open workspace
                      </Button>
                    </Link>
                  ) : (
                    <Link to={`/seller/products/${it.id}/edit`} className="mt-3 block">
                      <Button variant="outline" size="sm" className="w-full">
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            ))}
            {activeCollabs.map((c) => {
              const stage = stageMeta(c.stage);
              return (
                <Card key={c.id} className="overflow-hidden">
                  <div className="aspect-square bg-slate-50">
                    {c.base_image_url ? (
                      <img src={c.base_image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300">
                        <Package2 className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-medium text-slate-900">{c.title}</p>
                      <Badge tone={stage.tone}>{stage.label}</Badge>
                    </div>
                    <dl className="mt-2 space-y-1 text-sm text-slate-500">
                      <div className="flex justify-between gap-2">
                        <dt>Designer</dt>
                        <dd className="truncate font-medium text-slate-700">{c.counterpart}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Deadline</dt>
                        <dd className="font-medium text-slate-700">
                          {c.deadline ? new Date(c.deadline).toLocaleDateString() : "—"}
                        </dd>
                      </div>
                    </dl>
                    <Link to={`/collaborations/${c.id}`} className="mt-3 block">
                      <Button variant="outline" size="sm" className="w-full">
                        Open workspace
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : isLoading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={Package2}
            title={filtersOn ? "Nothing matches those filters" : `No ${TABS.find((t) => t.key === tab)?.label.toLowerCase()}`}
            hint={
              filtersOn
                ? "Try a different search term, category or date."
                : "Pick a blank from the catalog, add a design, then finalize it here."
            }
            action={
              filtersOn ? undefined : (
                <Link to="/seller/catalog">
                  <Button size="sm">
                    <Wand2 className="h-4 w-4" /> Browse catalog
                  </Button>
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const status = PRODUCT_STATUS[it.state];
            const busy = busyId === it.id;
            return (
              <Card key={it.id} className="overflow-hidden">
                <DesignPreviewThumb
                  baseImageUrl={it.base_image_url}
                  designUrl={it.design_url}
                  pos_x={it.pos_x}
                  pos_y={it.pos_y}
                  scale={it.scale}
                  rotation={it.rotation}
                />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium text-slate-900">{it.name}</p>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>

                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-lg font-semibold text-slate-900">€{it.price}</span>
                    <span className="text-sm text-emerald-600">you earn €{it.earnings}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {it.category ? `${it.category} · ` : ""}updated {timeAgo(it.updated_at)}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Link to={`/seller/products/${it.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>
                    </Link>

                    {it.state === "LISTED" ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setState.mutate({ id: it.id, state: "UNLISTED" })}
                          disabled={busy}
                        >
                          <EyeOff className="h-4 w-4" /> Unpublish
                        </Button>
                        {storeUrl && (
                          <a href={storeUrl} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="sm" title="View on storefront">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
                      </>
                    ) : it.state === "ARCHIVED" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setState.mutate({ id: it.id, state: "UNLISTED" })}
                        disabled={busy}
                      >
                        <ArchiveRestore className="h-4 w-4" /> Restore
                      </Button>
                    ) : (
                      // Only a draft WITH a design can go live — the API refuses
                      // anything else, so don't offer a button that always fails.
                      <Button
                        size="sm"
                        onClick={() => setState.mutate({ id: it.id, state: "LISTED" })}
                        disabled={busy || !it.design_url}
                        title={!it.design_url ? "Apply a design before publishing." : undefined}
                      >
                        <Rocket className="h-4 w-4" /> Publish
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      title="Duplicate"
                      onClick={() => duplicate.mutate(it.id)}
                      disabled={busy}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>

                    {it.state !== "ARCHIVED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Archive"
                        onClick={() => setState.mutate({ id: it.id, state: "ARCHIVED" })}
                        disabled={busy}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Deleting a live listing is refused by the API — don't offer it. */}
                    {it.state !== "LISTED" && (
                      <Button variant="ghost" size="sm" title="Delete" onClick={() => setConfirm(it)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}

                    {it.collaboration_id && (
                      <Link to={`/collaborations/${it.collaboration_id}`}>
                        <Button variant="ghost" size="sm" title="From a collaboration">
                          <MessagesSquare className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="max-w-sm p-6">
            <h3 className="font-semibold text-slate-900">Delete “{confirm.name}”?</h3>
            <p className="mt-2 text-sm text-slate-500">
              {confirm.state === "ARCHIVED"
                ? "This can't be undone."
                : "This can't be undone. If you only want it off your storefront, archive it instead — archived products keep their history and can be restored."}
            </p>
            {/* Errors render INSIDE the modal — the page-level banner sits under the overlay. */}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              {confirm.state !== "ARCHIVED" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setState.mutate({ id: confirm.id, state: "ARCHIVED" });
                    setConfirm(null);
                  }}
                >
                  <Archive className="h-4 w-4" /> Archive
                </Button>
              )}
              <Button onClick={() => remove.mutate(confirm.id)} disabled={remove.isPending}>
                {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
