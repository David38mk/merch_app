import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { addServerWishlist, getServerWishlist, mergeServerWishlist, removeServerWishlist } from "./api/wishlist";
import { useAuth } from "./auth";

/** The wishlist is a set of product ids. Cards (with live availability) are
 * fetched on the wishlist page — here we only track membership, so the heart
 * toggle on any product is instant. Mirrors the cart's guest→server→merge model. */
interface WishlistState {
  ids: string[];
  count: number;
  has: (id: string) => boolean;
  add: (id: string) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
}

const WishlistContext = createContext<WishlistState | null>(null);
const KEY = "mhc_wishlist";

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [ids, setIds] = useState<string[]>(load);
  const mode = useRef<"guest" | "server">("guest");
  const skipPersist = useRef(false);

  // On auth settling: a logged-in buyer's wishlist lives on the server. Merge
  // the guest's local list into it on login, then clear local. Guests: localStorage.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      if (user) {
        try {
          const local = load();
          const server = local.length ? await mergeServerWishlist(local) : await getServerWishlist();
          if (cancelled) return;
          localStorage.removeItem(KEY);
          mode.current = "server";
          skipPersist.current = true;
          setIds(server);
        } catch {
          /* offline / error → keep local as-is */
        }
      } else {
        mode.current = "guest";
        skipPersist.current = true;
        setIds(load());
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading]);

  // Guests persist to localStorage; server mode persists via the add/remove
  // calls themselves (optimistic), so there's nothing to write-through here.
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    if (mode.current === "guest") localStorage.setItem(KEY, JSON.stringify(ids));
  }, [ids]);

  // Mirror guest changes made in other tabs.
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === KEY && mode.current === "guest") {
        skipPersist.current = true;
        setIds(load());
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const value = useMemo<WishlistState>(() => {
    const add = (id: string) => {
      setIds((cur) => (cur.includes(id) ? cur : [id, ...cur]));
      if (mode.current === "server") addServerWishlist(id).catch(() => {});
    };
    const remove = (id: string) => {
      setIds((cur) => cur.filter((x) => x !== id));
      if (mode.current === "server") removeServerWishlist(id).catch(() => {});
    };
    const toggle = (id: string) => (ids.includes(id) ? remove(id) : add(id));
    return {
      ids,
      count: ids.length,
      has: (id: string) => ids.includes(id),
      add,
      remove,
      toggle,
    };
  }, [ids]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistState {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
