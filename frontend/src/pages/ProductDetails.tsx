import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  Loader2,
  Lock,
  Package2,
  RotateCcw,
  ShoppingCart,
  Store,
  Truck,
  ZoomIn,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getProductDetail, type ProductDetail } from "../api/marketplace";
import { useCart } from "../cart";
import { DesignPreviewThumb } from "../components/design/DesignPreviewThumb";
import { ProductTile } from "../components/marketplace/ProductTile";
import { BuyNowModal } from "../components/storefront/BuyNowModal";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/cn";
import { colorHex, isLightColor } from "../lib/colorHex";

export default function ProductDetails() {
  const { id = "" } = useParams();
  const { add } = useCart();
  const { data: p, isLoading, isError } = useQuery({
    queryKey: ["product", id],
    queryFn: () => getProductDetail(id),
  });

  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [buying, setBuying] = useState(false);
  const [view, setView] = useState<"composite" | "design" | "blank">("composite");
  const [zoom, setZoom] = useState(false);

  const availSet = useMemo(
    () => new Set((p?.variants ?? []).filter((v) => v.available).map((v) => `${v.color}|${v.size}`)),
    [p],
  );

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (isError || !p) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Package2 className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Product not found</h1>
        <p className="mt-2 text-sm text-slate-500">It may have been unlisted or the store taken down.</p>
        <Link to="/marketplace" className="mt-6 inline-block">
          <Button variant="outline">Back to marketplace</Button>
        </Link>
      </div>
    );
  }

  const colorAvailable = (c: string) => p.variants.some((v) => v.available && v.color === c);
  const sizeEnabled = (s: string) =>
    color ? availSet.has(`${color}|${s}`) : p.variants.some((v) => v.available && v.size === s);
  const comboOk = !!(color && size && availSet.has(`${color}|${size}`));
  const lineTotal = (Number(p.price) * qty).toFixed(2);

  const pickColor = (c: string) => {
    setColor(c);
    // Drop a size that isn't offered in the new colour.
    if (size && !availSet.has(`${c}|${size}`)) setSize(null);
    setErr(null);
  };

  const addToCart = () => {
    if (!comboOk) {
      setErr("Please select an available colour and size.");
      return;
    }
    add({
      shop_item_id: p.id,
      name: p.name,
      price: p.price,
      color: color!,
      size: size!,
      quantity: qty,
      brand_slug: p.brand.slug,
      brand_name: p.brand.name,
      base_image_url: p.base_image_url,
      design_url: p.design_url,
      pos_x: p.pos_x,
      pos_y: p.pos_y,
      scale: p.scale,
      rotation: p.rotation,
    });
    setAdded(true);
    setErr(null);
    setTimeout(() => setAdded(false), 2500);
  };

  const buyNow = () => {
    if (!comboOk) {
      setErr("Please select an available colour and size.");
      return;
    }
    setBuying(true);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4">
        <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ChevronLeft className="h-4 w-4" /> Marketplace
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ── Gallery ─────────────────────────────────────────── */}
        <div>
          <div className="relative">
            <button
              onClick={() => setZoom(true)}
              className="group block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white"
              title="Zoom"
            >
              <Hero p={p} view={view} />
              <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-600 opacity-0 transition group-hover:opacity-100">
                <ZoomIn className="h-4 w-4" />
              </span>
            </button>
          </div>
          <div className="mt-3 flex gap-3">
            <Thumb active={view === "composite"} onClick={() => setView("composite")}>
              <DesignPreviewThumb
                baseImageUrl={p.base_image_url}
                designUrl={p.design_url}
                pos_x={p.pos_x}
                pos_y={p.pos_y}
                scale={p.scale}
                rotation={p.rotation}
              />
            </Thumb>
            {p.design_url && (
              <Thumb active={view === "design"} onClick={() => setView("design")}>
                <img src={p.design_url} alt="Design" loading="lazy" className="h-full w-full object-contain p-2" />
              </Thumb>
            )}
            {p.base_image_url && (
              <Thumb active={view === "blank"} onClick={() => setView("blank")}>
                <img src={p.base_image_url} alt="Blank" loading="lazy" className="h-full w-full object-cover" />
              </Thumb>
            )}
          </div>
        </div>

        {/* ── Info + purchase ─────────────────────────────────── */}
        <div>
          <Link
            to={`/store/${p.brand.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
          >
            <Store className="h-4 w-4" /> {p.brand.name}
          </Link>
          <h1 className="mt-1.5 text-2xl font-bold text-slate-900">{p.name}</h1>
          <p className="mt-2 text-2xl font-semibold text-slate-900">€{p.price}</p>
          {p.category && <p className="mt-1 text-sm text-slate-400">{p.category}</p>}

          {p.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">{p.description}</p>
          )}

          {/* Colour */}
          {p.colors.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-slate-700">
                Colour{color ? <span className="font-normal text-slate-400"> · {color}</span> : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {p.colors.map((c) => {
                  const disabled = !colorAvailable(c);
                  return (
                    <button
                      key={c}
                      title={c}
                      disabled={disabled}
                      onClick={() => pickColor(c)}
                      className={cn(
                        "h-9 w-9 rounded-full ring-2 ring-offset-2 transition",
                        color === c ? "ring-brand-500" : "ring-transparent",
                        isLightColor(c) && "border border-slate-200",
                        disabled && "cursor-not-allowed opacity-30",
                      )}
                      style={{ background: colorHex(c) }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Size */}
          {p.sizes.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-slate-700">
                Size{size ? <span className="font-normal text-slate-400"> · {size}</span> : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {p.sizes.map((s) => {
                  const enabled = sizeEnabled(s);
                  return (
                    <button
                      key={s}
                      disabled={!enabled}
                      onClick={() => {
                        setSize(s);
                        setErr(null);
                      }}
                      className={cn(
                        "min-w-11 rounded-lg border px-3 py-2 text-sm font-medium transition",
                        size === s
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-slate-200 text-slate-700 hover:border-slate-300",
                        !enabled && "cursor-not-allowed text-slate-300 line-through hover:border-slate-200",
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-slate-700">Quantity</p>
            <div className="inline-flex items-center rounded-lg border border-slate-200">
              <button className="px-3 py-2 text-slate-500 hover:text-slate-800" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                −
              </button>
              <span className="min-w-10 text-center text-sm">{qty}</span>
              <button className="px-3 py-2 text-slate-500 hover:text-slate-800" onClick={() => setQty((q) => Math.min(50, q + 1))}>
                +
              </button>
            </div>
          </div>

          {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={addToCart}>
              {added ? <Check className="h-4 w-4 text-emerald-600" /> : <ShoppingCart className="h-4 w-4" />}
              {added ? "Added to cart" : "Add to cart"}
            </Button>
            <Button className="flex-1" onClick={buyNow}>
              Buy now · €{lineTotal}
            </Button>
          </div>
          {added && (
            <Link to="/cart" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
              View cart →
            </Link>
          )}

          {/* Materials / print method */}
          {(p.materials.length > 0 || p.print_methods.length > 0) && (
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {p.materials.length > 0 && (
                <span className="text-slate-500">
                  Material: <span className="text-slate-700">{p.materials.join(", ")}</span>
                </span>
              )}
              {p.print_methods.length > 0 && (
                <span className="text-slate-500">
                  Print: <span className="text-slate-700">{p.print_methods.join(", ")}</span>
                </span>
              )}
            </div>
          )}

          {/* Additional info */}
          <div className="mt-6 space-y-2 rounded-xl border border-slate-200 p-4 text-sm">
            <Info icon={Truck} label="Estimated delivery">
              {p.production_time ? `${p.production_time} to make, then shipping.` : "Ships in a few business days."}
            </Info>
            <Info icon={Package2} label="Shipping">Printed on demand and shipped by the creator's print partner.</Info>
            <Info icon={RotateCcw} label="Returns">30-day returns on faulty or misprinted items.</Info>
            <Info icon={Lock} label="Secure checkout">Payments are processed securely (test mode in this build).</Info>
          </div>
        </div>
      </div>

      {/* ── Related ─────────────────────────────────────────── */}
      {p.related.length > 0 && (
        <div className="mt-14">
          <h2 className="mb-5 text-xl font-bold text-slate-900">You might also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {p.related.map((rp) => (
              <ProductTile key={rp.id} p={rp} />
            ))}
          </div>
        </div>
      )}

      {/* Zoom overlay */}
      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-6" onClick={() => setZoom(false)}>
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="overflow-hidden rounded-2xl bg-white">
              <Hero p={p} view={view} />
            </div>
          </div>
        </div>
      )}

      {buying && (
        <BuyNowModal
          slug={p.brand.slug}
          product={{
            id: p.id,
            name: p.name,
            price: p.price,
            base_image_url: p.base_image_url,
            design_url: p.design_url,
            pos_x: p.pos_x,
            pos_y: p.pos_y,
            scale: p.scale,
            rotation: p.rotation,
            variants: p.variants.filter((v) => v.available).map((v) => ({ color: v.color, size: v.size })),
          }}
          initialColor={color ?? undefined}
          initialSize={size ?? undefined}
          initialQuantity={qty}
          onClose={() => setBuying(false)}
        />
      )}
    </div>
  );
}

function Hero({ p, view }: { p: ProductDetail; view: "composite" | "design" | "blank" }) {
  if (view === "design" && p.design_url) {
    return <img src={p.design_url} alt={p.name} className="aspect-square w-full bg-slate-50 object-contain p-8" />;
  }
  if (view === "blank" && p.base_image_url) {
    return <img src={p.base_image_url} alt={p.name} className="aspect-square w-full object-cover" />;
  }
  return (
    <DesignPreviewThumb
      baseImageUrl={p.base_image_url}
      designUrl={p.design_url}
      pos_x={p.pos_x}
      pos_y={p.pos_y}
      scale={p.scale}
      rotation={p.rotation}
    />
  );
}

function Thumb({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition",
        active ? "border-brand-500" : "border-slate-200 hover:border-slate-300",
      )}
    >
      {children}
    </button>
  );
}

function Info({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Truck;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <p className="text-slate-600">
        <span className="font-medium text-slate-800">{label}:</span> {children}
      </p>
    </div>
  );
}
