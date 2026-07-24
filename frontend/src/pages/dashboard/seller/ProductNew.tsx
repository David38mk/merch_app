import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, Loader2, Rocket, Save, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { getBaseItem } from "../../../api/catalog";
import { createShopItem, generateCopy, getCommission } from "../../../api/shopItems";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DesignPreviewThumb } from "../../../components/design/DesignPreviewThumb";
import { apiError } from "../../../lib/apiError";
import { clearEditor } from "../../../lib/designState";
import type { PlacedDesign, Placement } from "../../../lib/designState";
import type { ProductConfig } from "../../../lib/productConfig";

const eur = (n: number) => `€${n.toFixed(2)}`;

interface NavState {
  config?: ProductConfig;
  design?: PlacedDesign;
  placement?: Placement;
  area?: string | null;
  color?: string;
}

export default function ProductNew() {
  const loc = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const state = (loc.state as NavState | null) ?? {};
  const { config, design, placement } = state;

  const commission = useQuery({ queryKey: ["commission"], queryFn: getCommission });
  const base = useQuery({
    queryKey: ["catalog-item", config?.base_item_id],
    queryFn: () => getBaseItem(config!.base_item_id),
    enabled: !!config,
  });

  const [name, setName] = useState(config?.name ?? "");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [price, setPrice] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const cost = config?.unit_price ?? 0;
  const rate = commission.data?.commission_rate ?? 0.15;
  const minPrice = useMemo(() => Math.ceil((cost / (1 - rate)) * 100) / 100, [cost, rate]);

  // Suggest a sensible retail ONCE we know cost + rate. Guarded by a ref, not
  // `price === 0` — otherwise clearing the input to retype refills it instantly.
  const suggested = useRef(false);
  useEffect(() => {
    if (commission.data && !suggested.current) {
      suggested.current = true;
      setPrice(Math.max(minPrice, Math.ceil(cost * 2 * 100) / 100));
    }
  }, [commission.data, minPrice, cost]);

  const fee = price * rate;
  const earnings = price - cost - fee;

  const copyMut = useMutation({
    mutationFn: () => generateCopy(config!.base_item_id),
    onSuccess: (c) => {
      setName(c.title);
      setDescription(c.description);
      setTags(c.keywords.slice(0, 8));
    },
  });

  const saveMut = useMutation({
    mutationFn: (publish: boolean) =>
      createShopItem({
        base_item_id: config!.base_item_id,
        design_id: design!.id,
        print_area: state.area ?? null,
        pos_x: placement?.xPct ?? 50,
        pos_y: placement?.yPct ?? 45,
        scale: placement?.scale ?? 0.45,
        rotation: placement?.rotation ?? 0,
        name: name.trim(),
        description: description.trim() || undefined,
        tags,
        price,
        color: config!.color,
        size: config!.size,
        material: config!.material,
        print_type: config!.print_type,
        publish,
      }),
    onSuccess: () => {
      if (config) clearEditor(config.base_item_id);
      qc.invalidateQueries({ queryKey: ["shop-items"] });
      qc.invalidateQueries({ queryKey: ["seller-dashboard"] });
      navigate("/seller/products");
    },
    onError: (e) => setError(apiError(e, "Couldn't save the product.")),
  });

  // Guard: this page needs a configured product + a design from the editor.
  if (!config || !design) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <h1 className="text-xl font-bold text-slate-900">Start from a product</h1>
        <p className="mt-2 text-sm text-slate-500">
          Pick a blank, configure it and add a design first — then you can finalize it here.
        </p>
        <Link to="/seller/catalog" className="mt-6 inline-block">
          <Button variant="outline" size="sm">
            Browse catalog
          </Button>
        </Link>
      </div>
    );
  }

  const nameValid = name.trim().length > 0;
  const priceValid = price >= minPrice;
  const variantValid = Boolean(config.color && config.size);
  const imageValid = Boolean(config.image_url);
  const canSave = nameValid && priceValid && variantValid && imageValid && !saveMut.isPending;

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

  return (
    <div>
      <Link
        to={`/seller/design/${config.base_item_id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to design
      </Link>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="space-y-5 lg:col-span-3">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Product information</h2>
              <Button variant="outline" size="sm" onClick={() => copyMut.mutate()} disabled={copyMut.isPending}>
                {copyMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate with AI
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="label">
                  Product name <span className="text-red-500">*</span>
                </label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cosmic Wave Tee" />
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
                  <input className="input bg-slate-50 text-slate-500" value={base.data?.category ?? config.name} disabled />
                </div>
                <div>
                  <label className="label">Tags / keywords</label>
                  <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-300 p-1.5">
                    {tags.map((t) => (
                      <span key={t} className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
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

          {/* Profit calculator */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Price & profit</h2>
            <div className="mt-4">
              <label className="label">
                Selling price (€) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="input max-w-40"
                value={price || ""}
                onChange={(e) => setPrice(Number(e.target.value) || 0)}
              />
              {!priceValid && (
                <p className="mt-1.5 text-xs text-red-600">Minimum price is {eur(minPrice)} (covers cost + platform fee).</p>
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
        </div>

        {/* Review + publish */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <DesignPreviewThumb
              baseImageUrl={config.image_url}
              designUrl={design.resource_url}
              pos_x={placement?.xPct ?? 50}
              pos_y={placement?.yPct ?? 45}
              scale={placement?.scale ?? 0.45}
              rotation={placement?.rotation ?? 0}
            />
            <div className="p-5">
              <h2 className="font-semibold text-slate-900">Review</h2>
              <p className="truncate text-sm text-slate-500">{name || "Untitled product"}</p>

              <dl className="mt-4 space-y-1.5 text-sm">
                <Row label="Variant" value={[config.color, config.size].filter(Boolean).join(" · ") || "—"} />
                <Row label="Options" value={[config.material, config.print_type].filter(Boolean).join(" · ") || "—"} />
                <Row label="Provider" value={config.provider} />
                <Row label="Price" value={eur(price)} />
                <Row label="You earn" value={eur(Math.max(0, earnings))} strong />
              </dl>

              {/* Validations */}
              <div className="mt-4 space-y-1.5">
                <Check2 ok={nameValid} label="Product name" />
                <Check2 ok={imageValid} label="Product image" />
                <Check2 ok={Boolean(design)} label="Design applied" />
                <Check2 ok={variantValid} label="Variant selected" />
                <Check2 ok={priceValid} label={`Price ≥ ${eur(minPrice)}`} />
              </div>

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              <div className="mt-5 space-y-2">
                <Button className="w-full" onClick={() => saveMut.mutate(true)} disabled={!canSave}>
                  {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  Publish to storefront
                </Button>
                <Button variant="outline" className="w-full" onClick={() => saveMut.mutate(false)} disabled={!canSave}>
                  <Save className="h-4 w-4" /> Save as draft
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string | null; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={strong ? "font-semibold text-slate-900" : muted ? "text-slate-400" : "text-slate-700"}>{value ?? "—"}</dd>
    </div>
  );
}

function Check2({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${ok ? "text-emerald-600" : "text-slate-400"}`}>
      {ok ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {label}
    </div>
  );
}
