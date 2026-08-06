import type { OrderDisplayStatus } from "./orders";
import { api } from "./client";

export interface BuyerOrderSummary {
  id: string;
  short_id: string;
  store_name: string | null;
  store_slug: string | null;
  product_summary: string;
  thumbnail_url: string | null;
  item_count: number;
  total: string;
  created_at: string;
  status: OrderDisplayStatus;
  tracking_number: string | null;
}

export interface BuyerOrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: string;
  color: string | null;
  size: string | null;
  base_image_url: string | null;
  design_url: string | null;
  pos_x: number;
  pos_y: number;
  scale: number;
  rotation: number;
  fulfillment_status: string;
}

export interface BuyerOrderEvent {
  type: string;
  note: string | null;
  created_at: string;
}

export interface BuyerOrderDetail {
  id: string;
  short_id: string;
  status: OrderDisplayStatus;
  created_at: string;
  store_name: string | null;
  store_slug: string | null;
  subtotal: string;
  discount_amount: string;
  discount_code: string | null;
  shipping_amount: string;
  tax_amount: string;
  total: string;
  ship_name: string | null;
  ship_address: string | null;
  ship_city: string | null;
  ship_postal: string | null;
  ship_country: string | null;
  shipping_carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipping_method: string | null;
  est_delivery_from: string | null;
  est_delivery_to: string | null;
  delivered_at: string | null;
  items: BuyerOrderItem[];
  events: BuyerOrderEvent[];
}

export interface BuyerOrderFilters {
  q?: string;
  status?: OrderDisplayStatus;
  date_from?: string;
  date_to?: string;
}

export async function getBuyerOrders(filters: BuyerOrderFilters = {}): Promise<BuyerOrderSummary[]> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  return (await api.get<{ items: BuyerOrderSummary[] }>("/buyer/orders", { params })).data.items;
}

export async function getBuyerOrder(id: string): Promise<BuyerOrderDetail> {
  return (await api.get<BuyerOrderDetail>(`/buyer/orders/${id}`)).data;
}

/** A cart-ready line rebuilt from a past order (current price/mockup). */
export interface ReorderLine {
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

export interface ReorderResult {
  added: ReorderLine[];
  unavailable: string[];
}

export async function reorder(id: string): Promise<ReorderResult> {
  return (await api.post<ReorderResult>(`/buyer/orders/${id}/reorder`)).data;
}
