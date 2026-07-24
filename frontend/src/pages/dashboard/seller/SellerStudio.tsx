import { useQuery } from "@tanstack/react-query";
import {
  CircleDollarSign,
  ExternalLink,
  Package2,
  Rocket,
  ShoppingCart,
  Sparkles,
  Store,
  Wand2,
} from "lucide-react";
import { Link } from "react-router-dom";

import { getSellerDashboard } from "../../../api/dashboard";
import { listShopItems } from "../../../api/shopItems";
import { absoluteStoreUrl, getStorefront } from "../../../api/storefront";
import { DesignPreviewThumb } from "../../../components/design/DesignPreviewThumb";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Stat } from "../../../components/ui/Stat";
import { PRODUCT_STATUS } from "../../../lib/productStatus";
import { PUBLISH_STATUS } from "../../../lib/publishStatus";

export default function SellerStudio() {
  // Real numbers, not the placeholder literals this page used to hardcode.
  const { data: store } = useQuery({ queryKey: ["storefront"], queryFn: getStorefront });
  const { data: dash } = useQuery({ queryKey: ["seller-dashboard"], queryFn: getSellerDashboard });
  const { data: products } = useQuery({
    queryKey: ["shop-items", { sort: "updated_desc" as const }],
    queryFn: () => listShopItems({ sort: "updated_desc" }),
  });

  const liveUrl = absoluteStoreUrl(store?.store_url ?? null);
  const stats = dash?.stats;
  const recent = (products?.items ?? []).slice(0, 4);

  return (
    <div>
      <PageHeader
        title="Seller studio"
        subtitle="Design products, publish your storefront, and track sales."
        actions={
          <Link to="/seller/catalog">
            <Button>
              <Wand2 className="h-4 w-4" /> Design now
            </Button>
          </Link>
        }
      />

      {/* Storefront status — the entry point to building/publishing the brand page */}
      <Card className="mb-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
              <Store className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-900">Your storefront</h2>
                {store && (
                  <Badge tone={PUBLISH_STATUS[store.status].tone}>
                    {PUBLISH_STATUS[store.status].label}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {store ? PUBLISH_STATUS[store.status].hint : "Loading…"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {store?.status === "PUBLISHED" && liveUrl && (
              <a href={liveUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4" /> View live
                </Button>
              </a>
            )}
            <Link to="/seller/storefront">
              <Button size="sm">
                {store?.status === "DRAFT" ? (
                  <>
                    <Rocket className="h-4 w-4" /> Set up storefront
                  </>
                ) : store?.status === "UNPUBLISHED" ? (
                  <>
                    <Rocket className="h-4 w-4" /> Republish
                  </>
                ) : (
                  <>Edit storefront</>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={CircleDollarSign} label="Revenue" value="€0.00" hint="orders ship later" />
        <Stat icon={ShoppingCart} label="Orders" value={String(stats?.orders ?? 0)} hint="all time" />
        <Stat
          icon={Package2}
          label="Live products"
          value={String(stats?.live_products ?? 0)}
          hint={`of ${stats?.products ?? 0} total`}
        />
        <Stat icon={Sparkles} label="AI credits" value={String(stats?.ai_credits ?? 0)} hint="resets monthly" />
      </div>

      <div className="mt-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Your products</h2>
              <p className="text-sm text-slate-500">Pick a blank, drop on a design, set your price.</p>
            </div>
            {recent.length > 0 && (
              <Link to="/seller/products">
                <Button variant="outline" size="sm">
                  View all
                </Button>
              </Link>
            )}
          </div>

          {recent.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                icon={Package2}
                title="No products yet"
                hint="Start from a blank in the catalog, then design it with an upload or AI."
                action={
                  <Link to="/seller/catalog">
                    <Button size="sm">
                      <Wand2 className="h-4 w-4" /> Design your first product
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recent.map((it) => (
                <Link key={it.id} to={`/seller/products/${it.id}/edit`} className="group">
                  <div className="overflow-hidden rounded-xl border border-slate-200 transition group-hover:border-slate-300">
                    <DesignPreviewThumb
                      baseImageUrl={it.base_image_url}
                      designUrl={it.design_url}
                      pos_x={it.pos_x}
                      pos_y={it.pos_y}
                      scale={it.scale}
                      rotation={it.rotation}
                    />
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-800">{it.name}</p>
                        <Badge tone={PRODUCT_STATUS[it.state].tone}>{PRODUCT_STATUS[it.state].label}</Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-500">€{it.price}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
