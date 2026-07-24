import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { getServerCart, mergeServerCart, putServerCart } from "./api/cart";
import { useAuth } from "./auth";

/** One cart line. The mockup fields are snapshotted so the cart/checkout can
 * render the product without re-fetching it. Keyed by product + variant. */
export interface CartItem {
  shop_item_id: string;
  name: string;
  price: string;
  color: string;
  size: string;
  quantity: number;
  brand_slug: string;
  brand_name: string;
  base_image_url: string | null;
  design_url: string | null;
  pos_x: number;
  pos_y: number;
  scale: number;
  rotation: number;
}

export function lineKey(i: { shop_item_id: string; color: string; size: string }): string {
  return `${i.shop_item_id}|${i.color}|${i.size}`;
}

interface CartState {
  items: CartItem[];
  count: number;
  add: (item: CartItem) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clearBrand: (slug: string) => void;
  clear: () => void;
  byBrand: { slug: string; name: string; items: CartItem[]; subtotal: number }[];
}

const CartContext = createContext<CartState | null>(null);
const KEY = "mhc_cart";

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<CartItem[]>(load);
  // "guest" → localStorage; "server" → the buyer's persisted cart.
  const mode = useRef<"guest" | "server">("guest");
  // Set right before a programmatic setItems (auth sync / cross-tab) so the
  // persist effect doesn't immediately write the value it just loaded back.
  const skipPersist = useRef(false);

  // On auth settling: a logged-in buyer's cart lives on the server. Merge the
  // guest's local cart into it on login, then clear local. Guests use localStorage.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      if (user) {
        try {
          const local = load();
          const server = local.length ? await mergeServerCart(local) : await getServerCart();
          if (cancelled) return;
          localStorage.removeItem(KEY);
          mode.current = "server";
          skipPersist.current = true;
          setItems(server);
        } catch {
          /* offline / error → keep the local cart as-is */
        }
      } else {
        mode.current = "guest";
        skipPersist.current = true;
        setItems(load());
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading]);

  // Persist changes to the active backend.
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    if (mode.current === "server") {
      const t = setTimeout(() => {
        putServerCart(items).catch(() => {});
      }, 400);
      return () => clearTimeout(t);
    }
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  // Mirror guest-cart changes made in other tabs.
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === KEY && mode.current === "guest") {
        skipPersist.current = true;
        setItems(load());
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const value = useMemo<CartState>(() => {
    const add = (item: CartItem) =>
      setItems((cur) => {
        const key = lineKey(item);
        const existing = cur.find((i) => lineKey(i) === key);
        if (existing) {
          return cur.map((i) =>
            lineKey(i) === key ? { ...i, quantity: Math.min(50, i.quantity + item.quantity) } : i,
          );
        }
        return [...cur, item];
      });
    const setQty = (key: string, qty: number) =>
      setItems((cur) =>
        cur.map((i) => (lineKey(i) === key ? { ...i, quantity: Math.max(1, Math.min(50, qty)) } : i)),
      );
    const remove = (key: string) => setItems((cur) => cur.filter((i) => lineKey(i) !== key));
    const clearBrand = (slug: string) => setItems((cur) => cur.filter((i) => i.brand_slug !== slug));
    const clear = () => setItems([]);

    const groups = new Map<string, { slug: string; name: string; items: CartItem[]; subtotal: number }>();
    for (const i of items) {
      const g = groups.get(i.brand_slug) ?? { slug: i.brand_slug, name: i.brand_name, items: [], subtotal: 0 };
      g.items.push(i);
      g.subtotal += Number(i.price) * i.quantity;
      groups.set(i.brand_slug, g);
    }

    return {
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      add,
      setQty,
      remove,
      clearBrand,
      clear,
      byBrand: [...groups.values()],
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
