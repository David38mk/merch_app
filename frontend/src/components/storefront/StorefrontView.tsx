import { Mail, MapPin, Package2, Star, Store } from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import type { ButtonStyle, Theme } from "../../api/storefront";
import { cn } from "../../lib/cn";
import { colorHex, isLightColor } from "../../lib/colorHex";
import { SOCIALS } from "../../lib/socials";
import { DesignPreviewThumb } from "../design/DesignPreviewThumb";

export interface StorefrontProduct {
  id: string;
  name: string;
  price: string;
  category?: string | null;
  base_image_url: string | null;
  design_url: string | null;
  pos_x: number;
  pos_y: number;
  scale: number;
  rotation: number;
  featured?: boolean;
  /** In-stock colour/size combos (public payload only — the builder preview omits them). */
  variants?: { color: string; size: string }[];
}

export interface StorefrontViewData {
  brandName: string;
  creatorName?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  contactEmail?: string | null;
  location?: string | null;
  /** Social URLs keyed by platform code (INSTAGRAM, TIKTOK, …). */
  socials: Record<string, string>;
  theme?: Theme;
  products?: StorefrontProduct[];
}

const DEFAULT_THEME: Theme = { primary: "#6366f1", accent: "#ec4899", button_style: "rounded" };

// Radius for SMALL elements (buttons, chips, the avatar) — pill = fully round.
const RADIUS: Record<ButtonStyle, string> = {
  rounded: "0.5rem",
  pill: "9999px",
  square: "0",
};

// Radius for LARGE surfaces (product cards). Pill must NOT be 9999px here —
// on a card-sized rectangle that renders a giant ellipse that swallows the
// image and clips the name/price. Cards echo the style, capped at a sane curve.
const CARD_RADIUS: Record<ButtonStyle, string> = {
  rounded: "0.75rem",
  pill: "1.25rem",
  square: "0",
};

/** The builder preview feeds raw, as-typed URLs; the server only prepends
 * https:// at save time. Without this, "instagram.com/x" navigates in-app. */
function absolutize(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function initials(name: string): string {
  const letters = name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("");
  return letters.toUpperCase() || "?";
}

/** The buyer-facing storefront. Shared by the public /store/:slug page and the
 * builder's live preview, so what a seller previews is exactly what ships.
 *
 * `mobile` forces the phone layout regardless of viewport. Tailwind's `sm:`
 * breakpoints key off the WINDOW, so a 390px-wide preview box on a desktop
 * screen would otherwise render the desktop layout — a preview that lies. */
export function StorefrontView({
  data,
  className,
  mobile = false,
  shop = false,
  onBuy,
}: {
  data: StorefrontViewData;
  className?: string;
  mobile?: boolean;
  /** Public shopping chrome: a Featured section + sort/filter toolbar over the
   * grid. Off for the builder preview, which is about editing, not shopping. */
  shop?: boolean;
  /** Buyer-facing "Buy now" — only the public page passes this; previews stay inert. */
  onBuy?: (product: StorefrontProduct) => void;
}) {
  const links = SOCIALS.filter((s) => data.socials[s.code]);
  const theme = data.theme ?? DEFAULT_THEME;
  const products = data.products ?? [];

  // Theme travels as CSS variables — adding fonts/layouts later is just more vars.
  const themeVars = {
    "--sf-primary": theme.primary,
    "--sf-accent": theme.accent,
    "--sf-radius": RADIUS[theme.button_style] ?? RADIUS.rounded,
    "--sf-card-radius": CARD_RADIUS[theme.button_style] ?? CARD_RADIUS.rounded,
  } as CSSProperties;

  return (
    <div
      style={themeVars}
      className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card", className)}
    >
      {/* Cover */}
      <div
        className={cn("relative h-32", !mobile && "sm:h-48")}
        style={{ background: `linear-gradient(135deg, var(--sf-primary), var(--sf-accent))` }}
      >
        {data.coverUrl && <img src={data.coverUrl} alt="" className="h-full w-full object-cover" />}
      </div>

      {/* Identity */}
      <div className="px-6 pb-6">
        <div className={cn("-mt-10 flex items-end gap-4", !mobile && "sm:-mt-12")}>
          <span
            // `relative` matters: the cover above is positioned, so a static
            // avatar paints UNDER it — its top half was hidden behind the cover.
            className={cn(
              "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border-4 border-white text-xl font-bold text-white shadow-sm",
              !mobile && "sm:h-24 sm:w-24",
            )}
            style={{ background: "var(--sf-primary)", borderRadius: "var(--sf-radius)" }}
          >
            {data.logoUrl ? (
              <img src={data.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(data.brandName || "Store")
            )}
          </span>
        </div>

        <div className="mt-4">
          <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900">
            {data.brandName || "Your brand name"}
          </h1>
          {data.creatorName && <p className="mt-0.5 text-sm text-slate-500">by {data.creatorName}</p>}
        </div>

        {links.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {links.map((s) => (
              <a
                key={s.code}
                href={absolutize(data.socials[s.code])}
                target="_blank"
                rel="noreferrer"
                title={s.label}
                // CSS-only hover (not JS style mutation): touch taps used to
                // leave the button stuck in its hovered state forever.
                className="flex h-9 w-9 items-center justify-center border border-slate-200 text-slate-500 transition hover:bg-[color:var(--sf-primary)] hover:text-white"
                style={{ borderRadius: "var(--sf-radius)" }}
              >
                <s.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        )}

        {data.description && (
          <p className="mt-5 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {data.description}
          </p>
        )}

        {(data.contactEmail || data.location) && (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
            {data.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-slate-400" /> {data.location}
              </span>
            )}
            {data.contactEmail && (
              <a
                href={`mailto:${data.contactEmail}`}
                className="inline-flex min-w-0 items-center gap-1.5 hover:underline"
              >
                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="break-all">{data.contactEmail}</span>
              </a>
            )}
          </div>
        )}

        {/* Products */}
        <div className="mt-8 border-t border-slate-100 pt-6">
          {products.length === 0 ? (
            <>
              <SectionHeading>Products</SectionHeading>
              <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
                <Package2 className="h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-600">No products yet</p>
                <p className="mt-1 text-xs text-slate-400">This creator hasn't listed any products yet.</p>
              </div>
            </>
          ) : shop ? (
            <ShopProducts products={products} mobile={mobile} onBuy={onBuy} />
          ) : (
            <>
              <SectionHeading>Products</SectionHeading>
              <div className={cn("mt-4 grid grid-cols-2 gap-4", !mobile && "sm:grid-cols-3")}>
                {products.map((p) => (
                  <ProductCard key={p.id} p={p} onBuy={onBuy} showBadge />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 font-semibold text-slate-900">
      <Store className="h-4 w-4" style={{ color: "var(--sf-primary)" }} /> {children}
    </h2>
  );
}

function ProductCard({
  p,
  onBuy,
  showBadge,
}: {
  p: StorefrontProduct;
  onBuy?: (product: StorefrontProduct) => void;
  showBadge?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden border border-slate-200 bg-white"
      style={{ borderRadius: "var(--sf-card-radius)" }}
    >
      {showBadge && p.featured && (
        <span
          className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ background: "var(--sf-accent)" }}
        >
          <Star className="h-2.5 w-2.5 fill-current" /> Featured
        </span>
      )}
      <DesignPreviewThumb
        baseImageUrl={p.base_image_url}
        designUrl={p.design_url}
        pos_x={p.pos_x}
        pos_y={p.pos_y}
        scale={p.scale}
        rotation={p.rotation}
      />
      <div className="p-3">
        <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
        <p className="text-sm font-semibold" style={{ color: "var(--sf-primary)" }}>
          €{p.price}
        </p>
        {onBuy && (
          <button
            onClick={() => onBuy(p)}
            className="mt-2 w-full px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
            style={{ background: "var(--sf-primary)", borderRadius: "var(--sf-radius)" }}
          >
            Buy now
          </button>
        )}
      </div>
    </div>
  );
}

type Sort = "featured" | "price_asc" | "price_desc";

/** The public shopping experience: a seller-curated Featured row plus the full
 * grid with client-side category/colour filters and price sort. Curation is the
 * default highlight — the Featured row hides the moment a buyer narrows results. */
function ShopProducts({
  products,
  mobile,
  onBuy,
}: {
  products: StorefrontProduct[];
  mobile: boolean;
  onBuy?: (product: StorefrontProduct) => void;
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("featured");

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))] as string[],
    [products],
  );
  const colors = useMemo(
    () => [...new Set(products.flatMap((p) => (p.variants ?? []).map((v) => v.color)))],
    [products],
  );

  const filtered = useMemo(() => {
    let list = products;
    if (category) list = list.filter((p) => p.category === category);
    if (color) list = list.filter((p) => (p.variants ?? []).some((v) => v.color === color));
    if (sort === "price_asc") list = [...list].sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort === "price_desc") list = [...list].sort((a, b) => Number(b.price) - Number(a.price));
    return list;
  }, [products, category, color, sort]);

  const active = category !== null || color !== null || sort !== "featured";
  const featured = products.filter((p) => p.featured);
  const gridCols = cn("grid grid-cols-2 gap-4", !mobile && "sm:grid-cols-3");

  return (
    <div>
      {/* Featured row — only when nothing is narrowing the results. */}
      {!active && featured.length > 0 && (
        <div className="mb-8">
          <SectionHeading>Featured</SectionHeading>
          <div className={cn("mt-4", gridCols)}>
            {featured.map((p) => (
              <ProductCard key={p.id} p={p} onBuy={onBuy} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading>All products</SectionHeading>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600"
        >
          <option value="featured">Featured</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </div>

      {/* Filters */}
      {(categories.length > 1 || colors.length > 1) && (
        <div className="mt-3 space-y-2">
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={category === null} onClick={() => setCategory(null)}>All</FilterChip>
              {categories.map((c) => (
                <FilterChip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
                  {c}
                </FilterChip>
              ))}
            </div>
          )}
          {colors.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  title={c}
                  onClick={() => setColor(color === c ? null : c)}
                  className={cn(
                    "h-6 w-6 rounded-full ring-2 ring-offset-2 transition",
                    color === c ? "ring-[color:var(--sf-primary)]" : "ring-transparent",
                    isLightColor(c) && "border border-slate-200",
                  )}
                  style={{ background: colorHex(c) }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {filtered.length > 0 ? (
        <div className={cn("mt-4", gridCols)}>
          {filtered.map((p) => (
            <ProductCard key={p.id} p={p} onBuy={onBuy} showBadge />
          ))}
        </div>
      ) : (
        <p className="mt-6 text-center text-sm text-slate-400">No products match these filters.</p>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-transparent bg-[color:var(--sf-primary)] text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
      )}
    >
      {children}
    </button>
  );
}
