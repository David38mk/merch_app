import { api } from "./client";

/** A saved product rendered with live availability. Carries the cart-line
 * fields so a single-variant product can be moved to the cart without a refetch. */
export interface WishlistCard {
  shop_item_id: string;
  name: string;
  price: string;
  category: string | null;
  brand_slug: string;
  brand_name: string;
  base_image_url: string | null;
  design_url: string | null;
  pos_x: number;
  pos_y: number;
  scale: number;
  rotation: number;
  available: boolean;
  sole_variant: { color: string; size: string; available: boolean } | null;
}

// ── server-persisted id list (logged-in buyers) ──────────────────────────────

export async function getServerWishlist(): Promise<string[]> {
  return (await api.get<{ ids: string[] }>("/buyer/wishlist")).data.ids;
}

export async function addServerWishlist(shopItemId: string): Promise<string[]> {
  return (await api.post<{ ids: string[] }>("/buyer/wishlist", { shop_item_id: shopItemId })).data.ids;
}

export async function removeServerWishlist(shopItemId: string): Promise<string[]> {
  return (await api.delete<{ ids: string[] }>(`/buyer/wishlist/${shopItemId}`)).data.ids;
}

export async function mergeServerWishlist(ids: string[]): Promise<string[]> {
  return (await api.post<{ ids: string[] }>("/buyer/wishlist/merge", { ids })).data.ids;
}

// ── public card rendering (guests + logged-in) ───────────────────────────────

export async function getWishlistCards(ids: string[]): Promise<WishlistCard[]> {
  if (ids.length === 0) return [];
  return (await api.post<WishlistCard[]>("/marketplace/wishlist-cards", { ids })).data;
}
