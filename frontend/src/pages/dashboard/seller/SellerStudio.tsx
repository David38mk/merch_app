import { CircleDollarSign, ExternalLink, Package2, Rocket, ShoppingCart, Sparkles, Store, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getStorefront, type StorefrontState } from "../../../api/storefront";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Stat } from "../../../components/ui/Stat";

export default function SellerStudio() {
  const [store, setStore] = useState<StorefrontState | null>(null);

  useEffect(() => {
    getStorefront()
      .then(setStore)
      .catch(() => setStore(null));
  }, []);

  return (
    <div>
      <PageHeader
        title="Seller studio"
        subtitle="Design products, publish your storefront, and track sales."
        actions={
          <Link to="/seller/products">
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
                {store &&
                  (store.is_published ? <Badge tone="green">Live</Badge> : <Badge tone="amber">Draft</Badge>)}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {store?.is_published
                  ? "Your brand page is live for customers to visit."
                  : "Customize your brand and publish it to get a public URL."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {store?.is_published && store.slug && (
              <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4" /> View live
                </Button>
              </a>
            )}
            <Link to="/seller/storefront">
              <Button size="sm">
                {store?.is_published ? (
                  <>Edit storefront</>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" /> Set up storefront
                  </>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={CircleDollarSign} label="Revenue" value="€0.00" hint="last 30 days" />
        <Stat icon={ShoppingCart} label="Orders" value="0" hint="all time" />
        <Stat icon={Package2} label="Live products" value="0" hint="of 5 on Free plan" />
        <Stat icon={Sparkles} label="AI credits" value="10" hint="resets monthly" />
      </div>

      <div className="mt-6">
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900">Your products</h2>
          <p className="mb-5 text-sm text-slate-500">Pick a blank, drop on a design, set your price.</p>
          <EmptyState
            icon={Package2}
            title="No products yet"
            hint="Start from a blank in the catalog, then design it with an upload or AI."
            action={
              <Link to="/seller/products">
                <Button size="sm">
                  <Wand2 className="h-4 w-4" /> Design your first product
                </Button>
              </Link>
            }
          />
        </Card>
      </div>
    </div>
  );
}
