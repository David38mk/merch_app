import { ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";

import { useCart } from "../../cart";

/** Cart icon + item-count badge, linking to /cart. */
export function CartButton() {
  const { count } = useCart();
  return (
    <Link
      to="/cart"
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
      title="Cart"
      aria-label={`Cart (${count} items)`}
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
