import { useQuery } from "@tanstack/react-query";
import { Heart, Loader2, ShoppingCart, Store, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getWishlistCards, type WishlistCard } from "../api/wishlist";
import { useCart } from "../cart";
import { DesignPreviewThumb } from "../components/design/DesignPreviewThumb";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useWishlist } from "../wishlist";

export default function Wishlist() {
  const { ids, remove } = useWishlist();

  const { data: cards, isLoading } = useQuery({
    queryKey: ["wishlist-cards", ids],
    queryFn: () => getWishlistCards(ids),
    // ids drive the query; empty list resolves to [] without a request.
  });

  if (ids.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Card className="p-6">
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty"
            hint="Tap the heart on any product to save it here for later."
            action={
              <Link to="/marketplace">
                <Button size="sm">Browse products</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Your wishlist</h1>
        <Link to="/marketplace" className="text-sm font-medium text-brand-700 hover:underline">
          Continue shopping →
        </Link>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(cards ?? []).map((c) => (
            <WishlistTile key={c.shop_item_id} c={c} onRemove={() => remove(c.shop_item_id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function WishlistTile({ c, onRemove }: { c: WishlistCard; onRemove: () => void }) {
  const { add } = useCart();
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);

  // Move to cart: a single-variant product adds straight to the cart; a product
  // with multiple sizes/colours opens the product page to pick options first.
  const moveToCart = () => {
    if (!c.available) return;
    if (c.sole_variant) {
      add({
        shop_item_id: c.shop_item_id,
        name: c.name,
        price: c.price,
        color: c.sole_variant.color,
        size: c.sole_variant.size,
        quantity: 1,
        brand_slug: c.brand_slug,
        brand_name: c.brand_name,
        base_image_url: c.base_image_url,
        design_url: c.design_url,
        pos_x: c.pos_x,
        pos_y: c.pos_y,
        scale: c.scale,
        rotation: c.rotation,
      });
      onRemove(); // moved out of the wishlist and into the cart
      setAdded(true);
    } else {
      navigate(`/p/${c.shop_item_id}`);
    }
  };

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="relative">
        <Link to={`/p/${c.shop_item_id}`} className="block aspect-square overflow-hidden bg-slate-50">
          <DesignPreviewThumb
            baseImageUrl={c.base_image_url}
            designUrl={c.design_url}
            pos_x={c.pos_x}
            pos_y={c.pos_y}
            scale={c.scale}
            rotation={c.rotation}
          />
        </Link>
        <button
          onClick={onRemove}
          title="Remove from wishlist"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm hover:text-rose-600"
        >
          <X className="h-4 w-4" />
        </button>
        {!c.available && (
          <span className="absolute left-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[11px] font-medium text-white">
            Unavailable
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <Link
          to={`/store/${c.brand_slug}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
        >
          <Store className="h-3 w-3" /> {c.brand_name}
        </Link>
        <Link to={`/p/${c.shop_item_id}`} className="mt-1 line-clamp-2 font-medium text-slate-900 hover:underline">
          {c.name}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-lg font-semibold text-slate-900">€{c.price}</p>
          <span className={c.available ? "text-xs font-medium text-emerald-600" : "text-xs font-medium text-slate-400"}>
            {c.available ? "In stock" : "Out of stock"}
          </span>
        </div>

        <div className="mt-3 flex-1" />
        <Button className="w-full" size="sm" onClick={moveToCart} disabled={!c.available || added}>
          {added ? (
            "Moved to cart"
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" />
              {c.available ? (c.sole_variant ? "Move to cart" : "Choose options") : "Unavailable"}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
