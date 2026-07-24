import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Check,
  Copy,
  EyeOff,
  History,
  Loader2,
  Rocket,
  Save,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { getBaseItem } from "../../../api/catalog";
import {
  deleteShopItem,
  duplicateShopItem,
  getCommission,
  getShopItem,
  listRevisions,
  updateShopItem,
  type ShopItemPatch,
  type ShopItemState,
} from "../../../api/shopItems";
import { DesignPreviewThumb } from "../../../components/design/DesignPreviewThumb";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { apiError } from "../../../lib/apiError";
import { cn } from "../../../lib/cn";
import { colorHex, isLightColor } from "../../../lib/colorHex";
import type { PlacedDesign, Placement } from "../../../lib/designState";
import { PRODUCT_STATUS } from "../../../lib/productStatus";
import { timeAgo } from "../../../lib/timeAgo";

const eur = (n: number) => `€${n.toFixed(2)}`;

/** What the design editor hands back when it returns here. */
interface DesignHandoff {
  design?: PlacedDesign;
  placement?: Placement;
  area?: string | null;
  color?: string;
}

/** Edit any facet of an existing product: information, variant, artwork,
 * visibility. Mirrors the creation flow — and for the design step it literally
 * reuses it, rather than growing a second editor that would drift. */
export default function ProductEdit() {
  const { id = "" } = useParams();
  const loc = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: item, isLoading } = useQuery({
    queryKey: ["shop-item", id],
    queryFn: () => getShopItem(id),
  });
  const { data: base } = useQuery({
    queryKey: ["catalog-item", item?.base_item_id],
    queryFn: () => getBaseItem(item!.base_item_id),
    enabled: !!item,
  });
  const { data: revisions } = useQuery({ queryKey: ["revisions", id], queryFn: () => listRevisions(id) });
  // The real plan rate — deriving it from quantized platform_fee/price drifts a
  // cent and collapses to 0 for tiny prices; this is the server's own number.
  const { data: commission } = useQuery({ queryKey: ["commission"], queryFn: getCommission });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [price, setPrice] = useState(0);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [material, setMaterial] = useState("");
  const [printType, setPrintType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Artwork picked up from the design editor, held unsaved until the seller saves.
  const handoff = (loc.state as DesignHandoff | null) ?? {};
  const [pendingDesign, setPendingDesign] = useState<DesignHandoff | null>(
    handoff.design ? handoff : null,
  );

  // Hydrate ONCE. The query refetches on window focus; re-running this on every
  // new `item` object would wipe whatever the seller is mid-typing.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!item || hydrated.current) return;
    hydrated.current = true;
    setName(item.name);
    setDescription(item.description ?? "");
    setTags(item.tags);
    setPrice(Number(item.price));
    // A colour picked inside the design editor rides the handoff and wins.
    setColor(handoff.color || item.color || "");
    setSize(item.size ?? "");
    setMaterial(item.material ?? "");
    setPrintType(item.print_type ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  // If the (possibly handoff-changed) colour doesn't stock the current size,
  // clear it so the save can't submit an unfillable combo.
  useEffect(() => {
    if (!base || !color || !size) return;
    const stocked = base.variants.some((v) => v.color === color && v.size === size && v.is_available);
    if (!stocked) setSize("");
  }, [base, color, size]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["shop-item", id] });
    qc.invalidateQueries({ queryKey: ["revisions", id] });
    qc.invalidateQueries({ queryKey: ["shop-items"] });
  };

  const save = useMutation({
    mutationFn: (state?: ShopItemState) => {
      const patch: ShopItemPatch = {
        name: name.trim(),
        description: description.trim(),
        tags,
        price,
        // material/print_type are sent even when empty — "" is how the server
        // clears one. Omitting them made "None" silently un-selectable.
        material,
        print_type: printType,
        ...(color ? { color } : {}),
        ...(size ? { size } : {}),
        ...(state ? { state } : {}),
      };
      if (pendingDesign?.design) {
        patch.design_id = pendingDesign.design.id;
        patch.print_area = pendingDesign.area ?? undefined;
        patch.pos_x = pendingDesign.placement?.xPct;
        patch.pos_y = pendingDesign.placement?.yPct;
        patch.scale = pendingDesign.placement?.scale;
        patch.rotation = pendingDesign.placement?.rotation;
      }
      return updateShopItem(id, patch);
    },
    onSuccess: () => {
      setError(null);
      setSaved(true);
      setPendingDesign(null);
      // Drop the handoff so a refresh doesn't re-apply an already-saved design.
      nav(".", { replace: true, state: null });
      setTimeout(() => setSaved(false), 2200);
      refresh();
    },
    onError: (e) => setError(apiError(e, "Couldn't save the product.")),
  });
  const duplicate = useMutation({
    mutationFn: () => duplicateShopItem(id),
    onSuccess: (copy) => {
      qc.invalidateQueries({ queryKey: ["shop-items"] });
      nav(`/seller/products/${copy.id}/edit`);
    },
    onError: (e) => setError(apiError(e, "Couldn't duplicate.")),
  });
  const remove = useMutation({
    mutationFn: () => deleteShopItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop-items"] });
      nav("/seller/products");
    },
    onError: (e) => setError(apiError(e, "Couldn't delete.")),
  });

  // Sizes stocked in the chosen colour — picking an unavailable combo is refused
  // by the API, so the UI shouldn't offer it in the first place.
  const sizesForColor = useMemo(() => {
    if (!base) return [];
    return base.variants.filter((v) => v.color === color && v.is_available).map((v) => v.size);
  }, [base, color]);

  if (isLoading || !item) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const product = item; // narrowed alias — TS drops the guard inside closures
  const status = PRODUCT_STATUS[product.state];

  // Cost changes with the variant, so recompute the floor locally for instant
  // feedback; the server re-derives it authoritatively on save.
  const rate = commission?.commission_rate ?? 0.15;
  const variantUnchanged =
    color === (product.color ?? "") &&
    size === (product.size ?? "") &&
    material === (product.material ?? "") &&
    printType === (product.print_type ?? "");
  const deltas = base
    ? (base.variants.find((v) => v.color === color && v.size === size)?.price_delta ?? "0") : "0";
  // Options matched by kind+name, exactly like the server's _cost — matching by
  // name alone cross-counts a material and a print type that share a name.
  const optionDelta = base
    ? base.print_options
        .filter(
          (o) =>
            (o.kind === "MATERIAL" && o.name === material) ||
            (o.kind === "PRINT_TYPE" && o.name === printType),
        )
        .reduce((sum, o) => sum + Number(o.price_delta), 0)
    : 0;
  const cost = base ? Number(base.base_price) + Number(deltas) + optionDelta : Number(product.production_cost);
  // For an untouched variant the server's min_price is the truth; local math is
  // only needed once the seller changes the selection.
  const minPrice = variantUnchanged
    ? Number(product.min_price)
    : Math.ceil((cost / (1 - rate)) * 100) / 100;
  const fee = price * rate;
  const earnings = price - cost - fee;

  const designUrl = pendingDesign?.design?.resource_url ?? product.design_url;
  const placement = pendingDesign?.placement;

  const nameValid = name.trim().length > 0;
  const priceValid = price >= minPrice;
  const designValid = Boolean(designUrl);
  const variantValid = Boolean(color && size);
  const canSave = nameValid && priceValid && variantValid && !save.isPending;

  function addTag(v: string) {
    const t = v.trim().replace(/,$/, "");
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }
  function onTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    }
  }

  function openDesignEditor() {
    nav(`/seller/design/${product.base_item_id}`, {
      state: {
        editing: {
          productId: product.id,
          productName: product.name,
          // Hand over the real design id — if the seller keeps this artwork and
          // only nudges the placement, it comes back as a valid reference.
          design:
            pendingDesign?.design ??
            (product.design_id && product.design_url
              ? { id: product.design_id, resource_url: product.design_url, source: "existing" }
              : null),
          placement: placement ?? {
            xPct: product.pos_x,
            yPct: product.pos_y,
            scale: product.scale,
            rotation: product.rotation,
          },
          area: pendingDesign?.area ?? product.print_area,
          color,
        },
      },
    });
  }

  return (
    <div>
      <Link
        to="/seller/products"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to my products
      </Link>

      <PageHeader
        title="Edit product"
        subtitle={`Last updated ${timeAgo(product.updated_at)}`}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          {/* Product information */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Product information</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="label">
                  Product name <span className="text-red-500">*</span>
                </label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input min-h-24 resize-y"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell buyers what makes it special."
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Category</label>
                  <input
                    className="input bg-slate-50 text-slate-500"
                    value={product.category ?? "—"}
                    disabled
                    title="Category comes from the blank you chose."
                  />
                </div>
                <div>
                  <label className="label">Tags / keywords</label>
                  <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-300 p-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                      >
                        {t}
                        <button onClick={() => setTags((p) => p.filter((x) => x !== t))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      className="min-w-20 flex-1 px-1 text-sm outline-none"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={onTagKey}
                      onBlur={() => addTag(tagInput)}
                      placeholder={tags.length ? "" : "Add a tag…"}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Design */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Design</h2>
              <Button variant="outline" size="sm" onClick={openDesignEditor}>
                <Wand2 className="h-4 w-4" /> Change design
              </Button>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {designUrl ? (
                  <img src={designUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-300">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="text-sm">
                {pendingDesign?.design ? (
                  <>
                    <p className="font-medium text-amber-600">New artwork ready — not saved yet</p>
                    <p className="text-slate-500">Save to apply it to this product.</p>
                  </>
                ) : designUrl ? (
                  <>
                    <p className="font-medium text-slate-700">Current artwork</p>
                    <p className="text-slate-500">
                      Upload new art, generate with AI, or adjust the placement.
                    </p>
                  </>
                ) : (
                  <p className="text-slate-500">No design applied — add one before publishing.</p>
                )}
              </div>
            </div>
          </Card>

          {/* Variants */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Variant & print options</h2>
            <p className="text-sm text-slate-500">Changing these updates the production cost.</p>

            {!base ? (
              <div className="mt-4 flex h-16 items-center text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="label">Colour</label>
                  <div className="flex flex-wrap gap-2">
                    {base.colors.map((cKey) => {
                      const hex = colorHex(cKey);
                      const active = color === cKey;
                      const light = isLightColor(cKey); // takes the NAME, not the hex
                      return (
                        <button
                          key={cKey}
                          title={cKey}
                          onClick={() => {
                            setColor(cKey);
                            // Keep the size only if the new colour stocks it.
                            const stocked = base.variants.some(
                              (v) => v.color === cKey && v.size === size && v.is_available,
                            );
                            if (!stocked) setSize("");
                          }}
                          className={cn(
                            "h-8 w-8 rounded-full border-2 transition",
                            active ? "border-brand-600 ring-2 ring-brand-100" : "border-slate-200",
                            light && "shadow-inner",
                          )}
                          style={{ background: hex }}
                        />
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="label">Size</label>
                  <div className="flex flex-wrap gap-2">
                    {base.sizes.map((s) => {
                      const available = sizesForColor.includes(s);
                      return (
                        <button
                          key={s}
                          disabled={!available}
                          onClick={() => setSize(s)}
                          title={available ? s : `Not available in ${color || "this colour"}`}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                            size === s
                              ? "border-brand-600 bg-brand-50 text-brand-700"
                              : "border-slate-200 text-slate-600 hover:border-slate-300",
                            !available && "cursor-not-allowed opacity-30",
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <OptionSelect
                    label="Material"
                    value={material}
                    onChange={setMaterial}
                    options={base.print_options.filter((o) => o.kind === "MATERIAL")}
                  />
                  <OptionSelect
                    label="Print type"
                    value={printType}
                    onChange={setPrintType}
                    options={base.print_options.filter((o) => o.kind === "PRINT_TYPE")}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Price & profit */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Price & profit</h2>
            <div className="mt-4">
              <label className="label">
                Selling price (€) <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="input max-w-40"
                  value={price || ""}
                  onChange={(e) => setPrice(Number(e.target.value) || 0)}
                />
                {!priceValid && (
                  <Button variant="outline" size="sm" onClick={() => setPrice(minPrice)}>
                    Set to {eur(minPrice)}
                  </Button>
                )}
              </div>
              {!priceValid && (
                <p className="mt-1.5 text-xs text-red-600">
                  Minimum price is {eur(minPrice)} (covers cost + platform fee).
                </p>
              )}
            </div>

            <dl className="mt-4 space-y-1.5 text-sm">
              <Row label="Base production cost" value={eur(cost)} />
              <Row label={`Platform fee (${Math.round(rate * 100)}%)`} value={`− ${eur(fee)}`} />
              <div className="my-1 border-t border-slate-100" />
              <Row label="Your earnings" value={eur(Math.max(0, earnings))} strong />
              <Row label="Final customer price" value={eur(price)} muted />
            </dl>
          </Card>

          {/* History */}
          <Card className="p-6">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <History className="h-4 w-4 text-slate-400" /> Change history
            </h2>
            {revisions && revisions.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {revisions.map((r) => (
                  <li key={r.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                    <div>
                      {r.summary.map((line) => (
                        <p key={line} className="text-slate-700">
                          {line}
                        </p>
                      ))}
                      <p className="text-xs text-slate-400">{timeAgo(r.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No edits yet — changes you save will appear here.</p>
            )}
          </Card>
        </div>

        {/* Preview + actions */}
        <div className="lg:col-span-2">
          <div className="sticky top-20">
            <Card className="overflow-hidden">
              <DesignPreviewThumb
                baseImageUrl={product.base_image_url}
                designUrl={designUrl}
                pos_x={placement?.xPct ?? product.pos_x}
                pos_y={placement?.yPct ?? product.pos_y}
                scale={placement?.scale ?? product.scale}
                rotation={placement?.rotation ?? product.rotation}
              />
              <div className="p-5">
                <h2 className="font-semibold text-slate-900">Preview</h2>
                <p className="truncate text-sm text-slate-500">{name || "Untitled product"}</p>

                <dl className="mt-4 space-y-1.5 text-sm">
                  <Row label="Blank" value={product.base_name} />
                  <Row label="Variant" value={[color, size].filter(Boolean).join(" · ") || "—"} />
                  <Row label="Options" value={[material, printType].filter(Boolean).join(" · ") || "—"} />
                  <Row label="Price" value={eur(price)} />
                  <Row label="You earn" value={eur(Math.max(0, earnings))} strong />
                </dl>

                <div className="mt-4 space-y-1.5">
                  <Validation ok={nameValid} label="Product name" />
                  <Validation ok={designValid} label="Design applied" />
                  <Validation ok={variantValid} label="Variant selected" />
                  <Validation ok={priceValid} label={`Price ≥ ${eur(minPrice)}`} />
                </div>

                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                {saved && <p className="mt-3 text-sm text-emerald-600">Changes saved.</p>}

                <div className="mt-5 space-y-2">
                  <Button className="w-full" onClick={() => save.mutate(undefined)} disabled={!canSave}>
                    {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {product.state === "UNLISTED" ? "Save draft" : "Save changes"}
                  </Button>

                  {product.state === "LISTED" ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => save.mutate("UNLISTED")}
                      disabled={!canSave}
                    >
                      <EyeOff className="h-4 w-4" /> Save & unpublish
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => save.mutate("LISTED")}
                      disabled={
                        !canSave || !designValid || product.state === "ARCHIVED" || product.state === "PENDING"
                      }
                      title={
                        product.state === "ARCHIVED"
                          ? "Restore this product to a draft before publishing it."
                          : product.state === "PENDING"
                            ? "Finish the collaboration first — the design isn't final yet."
                            : !designValid
                              ? "Apply a design before publishing."
                              : undefined
                      }
                    >
                      <Rocket className="h-4 w-4" /> Save & publish
                    </Button>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => duplicate.mutate()}
                      disabled={duplicate.isPending}
                    >
                      <Copy className="h-4 w-4" /> Duplicate
                    </Button>
                    {product.state !== "ARCHIVED" ? (
                      <Button
                        variant="ghost"
                        className="flex-1"
                        onClick={() => save.mutate("ARCHIVED")}
                        disabled={save.isPending}
                      >
                        <Archive className="h-4 w-4" /> Archive
                      </Button>
                    ) : (
                      <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="h-4 w-4 text-red-500" /> Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="max-w-sm p-6">
            <h3 className="font-semibold text-slate-900">Delete “{product.name}”?</h3>
            <p className="mt-2 text-sm text-slate-500">
              This removes the product and its change history for good.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button onClick={() => remove.mutate()} disabled={remove.isPending}>
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

// ── small pieces ──────────────────────────────────────────────────────────────

function OptionSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { name: string; price_delta: string }[];
}) {
  if (options.length === 0) return null;
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">None</option>
        {options.map((o) => (
          <option key={o.name} value={o.name}>
            {o.name}
            {Number(o.price_delta) ? ` (+€${o.price_delta})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string | null;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={strong ? "font-semibold text-slate-900" : muted ? "text-slate-400" : "text-slate-700"}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

function Validation({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", ok ? "text-emerald-600" : "text-slate-400")}>
      {ok ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {label}
    </div>
  );
}
