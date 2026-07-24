import { Loader2, ShoppingBag, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getPublicStorefront, type PublicStorefront } from "../../api/storefront";
import { useAuth } from "../../auth";
import { CartButton } from "../../components/cart/CartButton";
import { Brand } from "../../components/layout/Brand";
import { Button } from "../../components/ui/Button";
import { BuyNowModal } from "../../components/storefront/BuyNowModal";
import { StorefrontView, type StorefrontProduct } from "../../components/storefront/StorefrontView";

export default function Storefront() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<PublicStorefront | null>(null);
  const [buying, setBuying] = useState<StorefrontProduct | null>(null);
  const [loading, setLoading] = useState(true);
  // 404 (no such store) and a network blip are different messages — telling a
  // buyer a live store "doesn't exist" during a blip is a lie.
  const [failure, setFailure] = useState<"none" | "not-found" | "error">("none");

  useEffect(() => {
    // Ignore-stale guard: a slow response for the previous slug must not
    // overwrite the current one after navigation.
    let stale = false;
    setLoading(true);
    setFailure("none");
    getPublicStorefront(slug)
      .then((d) => {
        if (!stale) setData(d);
      })
      .catch((e: { response?: { status?: number } }) => {
        if (!stale) setFailure(e?.response?.status === 404 ? "not-found" : "error");
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [slug]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link to="/">
            <Brand />
          </Link>
          <div className="flex items-center gap-2">
            <CartButton />
            {user ? (
              <Link to="/orders">
                <Button variant="outline" size="sm">
                  <ShoppingBag className="h-4 w-4" /> My orders
                </Button>
              </Link>
            ) : (
              <>
                <Link to={`/login?next=${encodeURIComponent(`/store/${slug}`)}`}>
                  <Button variant="ghost" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link to="/sell">
                  <Button variant="outline" size="sm">
                    <Store className="h-4 w-4" /> Start selling
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : failure !== "none" || !data ? (
          <div className="mt-16 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Store className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-slate-900">
              {failure === "error" ? "Couldn't load this storefront" : "Storefront not found"}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
              {failure === "error"
                ? "Something went wrong on our side or with your connection — the store may well be fine."
                : "This store doesn't exist or hasn't been published yet."}
            </p>
            {failure === "error" ? (
              <Button variant="outline" size="sm" className="mt-6" onClick={() => window.location.reload()}>
                Try again
              </Button>
            ) : (
              <Link to="/" className="mt-6 inline-block">
                <Button variant="outline" size="sm">
                  Back to MyHappinessClub
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <StorefrontView
            shop
            onBuy={setBuying}
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
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        Powered by MyHappinessClub
      </footer>

      {buying && <BuyNowModal slug={slug} product={buying} onClose={() => setBuying(null)} />}
    </div>
  );
}
