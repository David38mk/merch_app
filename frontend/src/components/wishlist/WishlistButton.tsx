import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

import { useWishlist } from "../../wishlist";

/** Heart icon + saved-count badge, linking to /wishlist. */
export function WishlistButton() {
  const { count } = useWishlist();
  return (
    <Link
      to="/wishlist"
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
      title="Wishlist"
      aria-label={`Wishlist (${count} items)`}
    >
      <Heart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
