import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Loader2, Monitor, Rocket, Smartphone } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getStorefront,
  getStorefrontPreview,
  publishStorefront,
} from "../../../api/storefront";
import { StorefrontView } from "../../../components/storefront/StorefrontView";
import { Button } from "../../../components/ui/Button";
import { apiError } from "../../../lib/apiError";
import { cn } from "../../../lib/cn";

/** Full-page "what customers will see" check, between editing and publishing.
 * The payload comes from the same renderer the public page uses, so this is not
 * an approximation of the live site — it is the live site, minus publishing. */
export default function StorefrontPreview() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["storefront-preview"], queryFn: getStorefrontPreview });
  const { data: state } = useQuery({ queryKey: ["storefront"], queryFn: getStorefront });

  const publish = useMutation({
    mutationFn: publishStorefront,
    onSuccess: (s) => {
      qc.setQueryData(["storefront"], s);
      qc.invalidateQueries({ queryKey: ["storefront-preview"] });
      qc.invalidateQueries({ queryKey: ["seller-dashboard"] });
      nav("/seller/storefront");
    },
    onError: (e) => setError(apiError(e, "Couldn't publish.")),
  });

  const blockers = state?.blockers ?? [];

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-100">
      {/* Preview chrome — deliberately not the dashboard shell, so nothing on
          screen belongs to the seller's UI except this one bar. */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => nav("/seller/storefront")}>
          <ArrowLeft className="h-4 w-4" /> Back to editor
        </Button>

        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Eye className="h-4 w-4 text-brand-600" />
          Previewing your draft — not visible to customers
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {(["desktop", "mobile"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDevice(d)}
                title={d}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition",
                  device === d ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {d === "desktop" ? <Monitor className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
                {d}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => publish.mutate()}
            disabled={publish.isPending || blockers.length > 0}
            title={blockers.join(" ")}
          >
            {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {state?.status === "PUBLISHED" ? "Publish changes" : "Publish website"}
          </Button>
        </div>
      </header>

      {(error || blockers.length > 0) && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-700">
          {error ?? blockers.join(" ")}
        </p>
      )}

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        {isLoading || !data ? (
          <div className="flex h-64 items-center justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className={cn("mx-auto transition-all", device === "mobile" ? "max-w-[390px]" : "max-w-4xl")}>
            <StorefrontView
              mobile={device === "mobile"}
              data={{
                brandName: data.brand_name,
                creatorName: data.creator_name,
                description: data.description,
                logoUrl: data.logo_url,
                coverUrl: data.cover_url,
                contactEmail: data.contact_email,
                location: data.location,
                socials: data.socials,
                theme: data.theme,
                products: data.products,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
