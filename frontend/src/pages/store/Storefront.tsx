import { Loader2, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getPublicStorefront, type PublicStorefront } from "../../api/storefront";
import { Brand } from "../../components/layout/Brand";
import { Button } from "../../components/ui/Button";
import { StorefrontView } from "../../components/storefront/StorefrontView";

export default function Storefront() {
  const { slug = "" } = useParams();
  const [data, setData] = useState<PublicStorefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    getPublicStorefront(slug)
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link to="/">
            <Brand />
          </Link>
          <Link to="/signup">
            <Button variant="outline" size="sm">
              <Store className="h-4 w-4" /> Start selling
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : notFound || !data ? (
          <div className="mt-16 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Store className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-slate-900">Storefront not found</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
              This store doesn't exist or hasn't been published yet.
            </p>
            <Link to="/" className="mt-6 inline-block">
              <Button variant="outline" size="sm">
                Back to MyHappinessClub
              </Button>
            </Link>
          </div>
        ) : (
          <StorefrontView
            data={{
              brandName: data.brand_name,
              creatorName: data.creator_name,
              description: data.description,
              logoUrl: data.logo_url,
              coverUrl: data.cover_url,
              socials: data.socials,
            }}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        Powered by MyHappinessClub
      </footer>
    </div>
  );
}
