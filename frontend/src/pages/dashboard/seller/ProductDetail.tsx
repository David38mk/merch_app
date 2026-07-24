import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Clock, Heart, Loader2, Package, Truck, Users, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { favoriteItem, getBaseItem, unfavoriteItem, type BaseItemDetail } from "../../../api/catalog";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { cn } from "../../../lib/cn";
import { colorHex, isLightColor } from "../../../lib/colorHex";
import type { ProductConfig } from "../../../lib/productConfig";
import { pushRecentlyViewed } from "../../../lib/recentlyViewed";

const eur = (n: number) => `€${n.toFixed(2)}`;

interface Selection {
  color: string;
  size: string;
  material: string | null;
  print_type: string | null;
  position: string | null;
}

function defaultsFor(item: BaseItemDetail): Selection {
  const color = item.colors.find((c) => item.variants.some((v) => v.color === c && v.is_available)) ?? item.colors[0] ?? "";
  const size =
    item.sizes.find((s) => item.variants.some((v) => v.color === color && v.size === s && v.is_available)) ??
    item.sizes[0] ??
    "";
  const materials = item.print_options.filter((o) => o.kind === "MATERIAL");
  const methods = item.print_options.filter((o) => o.kind === "PRINT_TYPE");
  return {
    color,
    size,
    material: materials[0]?.name ?? null,
    print_type: methods[0]?.name ?? null,
    position: item.print_areas[0] ?? null,
  };
}

export default function ProductDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [fav, setFav] = useState(false);
  const [sel, setSel] = useState<Partial<Selection>>({});

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ["catalog-item", id],
    queryFn: () => getBaseItem(id),
  });

  useEffect(() => {
    if (item) {
      setFav(item.is_favorite);
      setSel({}); // reset to computed defaults for the new product
      pushRecentlyViewed({
        id: item.id,
        name: item.name,
        image_url: item.image_url,
        base_price: item.base_price,
        provider: item.provider,
      });
    }
  }, [item]);

  const toggle = useMutation({
    mutationFn: () => (fav ? unfavoriteItem(id) : favoriteItem(id)),
    onMutate: () => setFav((f) => !f),
    onError: () => setFav((f) => !f),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog"] }),
  });

  const defaults = useMemo(() => (item ? defaultsFor(item) : null), [item]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (isError || !item || !defaults) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <h1 className="text-xl font-bold text-slate-900">Product not found</h1>
        <p className="mt-2 text-sm text-slate-500">It may have been removed from the catalog.</p>
        <Link to="/seller/catalog" className="mt-6 inline-block">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" /> Back to catalog
          </Button>
        </Link>
      </div>
    );
  }

  // Narrowed alias so the helper closures below keep the non-undefined type.
  const product = item;

  // Current selection (falls back to computed defaults until the user picks).
  const color = sel.color ?? defaults.color;
  const size = sel.size ?? defaults.size;
  const material = sel.material !== undefined ? sel.material : defaults.material;
  const printType = sel.print_type !== undefined ? sel.print_type : defaults.print_type;
  const position = sel.position !== undefined ? sel.position : defaults.position;

  const materials = item.print_options.filter((o) => o.kind === "MATERIAL");
  const methods = item.print_options.filter((o) => o.kind === "PRINT_TYPE");

  const colorAvailable = (c: string) => product.variants.some((v) => v.color === c && v.is_available);
  const sizeAvailable = (c: string, s: string) =>
    product.variants.some((v) => v.color === c && v.size === s && v.is_available);

  function selectColor(c: string) {
    // keep the size if it's still valid for the new colour, else jump to the first that is
    const nextSize = sizeAvailable(c, size) ? size : product.sizes.find((s) => sizeAvailable(c, s)) ?? size;
    setSel((prev) => ({ ...prev, color: c, size: nextSize }));
  }

  const variant = item.variants.find((v) => v.color === color && v.size === size);
  const variantDelta = variant ? Number(variant.price_delta) : 0;
  const materialDelta = Number(materials.find((m) => m.name === material)?.price_delta ?? 0);
  const printDelta = Number(methods.find((m) => m.name === printType)?.price_delta ?? 0);
  const base = Number(item.base_price);
  const unitPrice = base + variantDelta + materialDelta + printDelta;

  const comboAvailable = variant ? variant.is_available : item.available;

  const breakdown = [
    ["Base", base],
    variantDelta ? [`Size ${size}`, variantDelta] : null,
    materialDelta ? [material as string, materialDelta] : null,
    printDelta ? [printType as string, printDelta] : null,
  ].filter(Boolean) as [string, number][];

  function buildConfig(): ProductConfig {
    return {
      base_item_id: product.id,
      name: product.name,
      image_url: product.image_url,
      provider: product.provider,
      color,
      size,
      material,
      print_type: printType,
      print_position: position,
      unit_price: unitPrice,
    };
  }

  const goDesign = () => navigate(`/seller/design/${product.id}`, { state: { config: buildConfig() } });
  const goHire = () => navigate("/seller/hiring/new", { state: { config: buildConfig() } });

  return (
    <div>
      <Link to="/seller/catalog" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back to catalog
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Preview */}
        <div>
          <Card className="overflow-hidden">
            <div className="relative aspect-square bg-slate-100">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-300">
                  <Package className="h-12 w-12" />
                </div>
              )}
              {/* Selected-colour indicator (per-colour mockups are the deferred mockup seam) */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/90 py-1 pl-1 pr-3 shadow-sm">
                <span
                  className={cn("h-6 w-6 rounded-full", isLightColor(color) && "ring-1 ring-slate-200")}
                  style={{ backgroundColor: colorHex(color) }}
                />
                <span className="text-xs font-medium text-slate-700">{color}</span>
              </div>
            </div>
          </Card>
          <p className="mt-2 text-center text-xs text-slate-400">
            Illustrative preview — realistic mockups arrive with the design tool.
          </p>
        </div>

        {/* Configurator */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              {item.category && <Badge tone="slate">{item.category}</Badge>}
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{item.name}</h1>
              <p className="mt-1 text-sm text-slate-500">by {item.provider}</p>
            </div>
            <button
              onClick={() => toggle.mutate()}
              title={fav ? "Remove from favorites" : "Save to favorites"}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:text-brand-600"
            >
              <Heart className={cn("h-5 w-5", fav && "fill-brand-500 text-brand-500")} />
            </button>
          </div>

          {item.description && <p className="mt-4 text-sm leading-relaxed text-slate-600">{item.description}</p>}

          {/* Meta */}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-slate-500">
            {item.production_time && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-400" /> {item.production_time}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-slate-400" /> Shipping calculated at checkout
            </span>
          </div>

          {/* Color */}
          <Field label="Color" value={color}>
            <div className="flex flex-wrap gap-2">
              {item.colors.map((c) => {
                const disabled = !colorAvailable(c);
                return (
                  <button
                    key={c}
                    disabled={disabled}
                    onClick={() => selectColor(c)}
                    title={disabled ? `${c} — out of stock` : c}
                    className={cn(
                      "relative h-8 w-8 rounded-full ring-2 ring-offset-2 transition",
                      color === c ? "ring-brand-500" : "ring-transparent",
                      isLightColor(c) && "border border-slate-200",
                      disabled && "cursor-not-allowed opacity-40",
                    )}
                    style={{ backgroundColor: colorHex(c) }}
                  />
                );
              })}
            </div>
          </Field>

          {/* Size */}
          <Field label="Size" value={size}>
            <div className="flex flex-wrap gap-2">
              {item.sizes.map((s) => {
                const disabled = !sizeAvailable(color, s);
                return (
                  <Chip key={s} active={size === s} disabled={disabled} onClick={() => setSel((p) => ({ ...p, size: s }))}>
                    {s}
                  </Chip>
                );
              })}
            </div>
          </Field>

          {/* Material */}
          {materials.length > 0 && (
            <Field label="Material" value={material ?? ""}>
              <div className="flex flex-wrap gap-2">
                {materials.map((m) => (
                  <Chip key={m.name} active={material === m.name} onClick={() => setSel((p) => ({ ...p, material: m.name }))}>
                    {m.name}
                    {Number(m.price_delta) > 0 && <span className="ml-1 text-brand-600">+{eur(Number(m.price_delta))}</span>}
                  </Chip>
                ))}
              </div>
            </Field>
          )}

          {/* Print type */}
          {methods.length > 0 && (
            <Field label="Print type" value={printType ?? ""}>
              <div className="flex flex-wrap gap-2">
                {methods.map((m) => (
                  <Chip
                    key={m.name}
                    active={printType === m.name}
                    onClick={() => setSel((p) => ({ ...p, print_type: m.name }))}
                  >
                    {m.name}
                    {Number(m.price_delta) > 0 && <span className="ml-1 text-brand-600">+{eur(Number(m.price_delta))}</span>}
                  </Chip>
                ))}
              </div>
            </Field>
          )}

          {/* Print position */}
          {item.print_areas.length > 0 && (
            <Field label="Print position" value={position ?? ""}>
              <div className="flex flex-wrap gap-2">
                {item.print_areas.map((a) => (
                  <Chip key={a} active={position === a} onClick={() => setSel((p) => ({ ...p, position: a }))}>
                    {a}
                  </Chip>
                ))}
              </div>
            </Field>
          )}

          {/* Price */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Base production price</p>
                <p className="mt-0.5 text-2xl font-bold text-slate-900">{eur(unitPrice)}</p>
              </div>
              {comboAvailable ? (
                <Badge tone="green">
                  <Check className="mr-1 h-3 w-3" /> Available
                </Badge>
              ) : (
                <Badge tone="amber">Out of stock</Badge>
              )}
            </div>
            {breakdown.length > 1 && (
              <p className="mt-2 text-xs text-slate-400">
                {breakdown.map(([label, val], i) => (
                  <span key={label}>
                    {i > 0 && " · "}
                    {label} {i === 0 ? eur(val) : `+${eur(val)}`}
                  </span>
                ))}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">Per-unit production cost. Your selling price and profit come next.</p>
          </div>

          {/* CTAs */}
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-slate-700">Choose how to create your design</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={goDesign} disabled={!comboAvailable}>
                <Wand2 className="h-4 w-4" /> Design yourself
              </Button>
              <Button variant="outline" onClick={goHire} disabled={!comboAvailable}>
                <Users className="h-4 w-4" /> Hire a designer
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── selectors ────────────────────────────────────────────────────────────────

function Field({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-sm font-medium text-slate-700">
        {label}
        {value && <span className="ml-2 font-normal text-slate-400">{value}</span>}
      </p>
      {children}
    </div>
  );
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
        active
          ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-100"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
        disabled && "cursor-not-allowed text-slate-300 line-through hover:border-slate-200",
      )}
    >
      {children}
    </button>
  );
}
