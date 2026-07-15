import { Package2, Store } from "lucide-react";

import { cn } from "../../lib/cn";
import { SOCIALS } from "../../lib/socials";

export interface StorefrontViewData {
  brandName: string;
  creatorName?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  /** Social URLs keyed by platform code (INSTAGRAM, TIKTOK, …). */
  socials: Record<string, string>;
}

function initials(name: string): string {
  const letters = name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("");
  return letters.toUpperCase() || "?";
}

/** The buyer-facing storefront. Shared by the public /store/:slug page and the
 * in-editor Preview, so what a seller previews is exactly what a customer sees. */
export function StorefrontView({ data, className }: { data: StorefrontViewData; className?: string }) {
  const links = SOCIALS.filter((s) => data.socials[s.code]);

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card", className)}>
      {/* Cover */}
      <div className="relative h-40 bg-gradient-to-br from-brand-100 to-brand-50 sm:h-56">
        {data.coverUrl && (
          <img src={data.coverUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      {/* Identity */}
      <div className="px-6 pb-6">
        <div className="-mt-10 flex items-end gap-4 sm:-mt-12">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-brand-600 text-xl font-bold text-white shadow-sm sm:h-24 sm:w-24">
            {data.logoUrl ? (
              <img src={data.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(data.brandName || "Store")
            )}
          </span>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {data.brandName || "Your brand name"}
          </h1>
          {data.creatorName && <p className="mt-0.5 text-sm text-slate-500">by {data.creatorName}</p>}
        </div>

        {links.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {links.map((s) => (
              <a
                key={s.code}
                href={data.socials[s.code]}
                target="_blank"
                rel="noreferrer"
                title={s.label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
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

        {/* Products — grid ships in a later goal; stubbed for now. */}
        <div className="mt-8 border-t border-slate-100 pt-6">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Store className="h-4 w-4 text-brand-600" /> Products
          </h2>
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
            <Package2 className="h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">Products coming soon</p>
            <p className="mt-1 text-xs text-slate-400">This creator hasn't listed any products yet.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
