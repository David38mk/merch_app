import type { CartItem } from "../cart";
import { api } from "./client";

/** The server cart returns the same shape as a client CartItem. */
export type ServerCartLine = CartItem;

interface LineIn {
  shop_item_id: string;
  color: string;
  size: string;
  quantity: number;
}

function toLines(items: CartItem[]): LineIn[] {
  return items.map((i) => ({
    shop_item_id: i.shop_item_id,
    color: i.color,
    size: i.size,
    quantity: i.quantity,
  }));
}

export async function getServerCart(): Promise<ServerCartLine[]> {
  return (await api.get<ServerCartLine[]>("/cart")).data;
}

export async function putServerCart(items: CartItem[]): Promise<ServerCartLine[]> {
  return (await api.put<ServerCartLine[]>("/cart", { items: toLines(items) })).data;
}

export async function mergeServerCart(items: CartItem[]): Promise<ServerCartLine[]> {
  return (await api.post<ServerCartLine[]>("/cart/merge", { items: toLines(items) })).data;
}
