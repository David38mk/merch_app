import { api } from "./client";

/** Derived server-side from payment + per-item production facts. */
export type OrderDisplayStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "IN_PRODUCTION"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export interface CheckoutPayload {
  shop_item_id: string;
  color: string;
  size: string;
  quantity: number;
  name: string;
  email: string;
  address: string;
  city: string;
  postal: string;
  country: string;
}

export interface CheckoutResult {
  order_id: string;
  short_id: string;
  total: string;
  status: string;
}

export interface OrderListItem {
  id: string;
  short_id: string;
  customer_name: string;
  product_summary: string;
  created_at: string;
  total: string;
  earnings: string;
  status: OrderDisplayStatus;
}

export type OrderCounts = Record<OrderDisplayStatus, number>;

export interface OrderList {
  items: OrderListItem[];
  counts: OrderCounts;
}

export interface OrderLine {
  id: string;
  name: string;
  quantity: number;
  unit_price: string;
  /** Per-unit production cost, snapshotted at purchase. */
  production_cost: string | null;
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

export interface OrderEvent {
  type: string;
  note: string | null;
  created_at: string;
}

export interface OrderDetail {
  id: string;
  short_id: string;
  status: OrderDisplayStatus;
  created_at: string;
  customer_name: string;
  customer_email: string | null;
  subtotal: string;
  commission_rate: string;
  commission_amount: string;
  production_total: string;
  earnings: string;
  payment_method: string;
  paid_at: string | null;
  ship_name: string | null;
  ship_address: string | null;
  ship_city: string | null;
  ship_postal: string | null;
  ship_country: string | null;
  tracking_number: string | null;
  items: OrderLine[];
  events: OrderEvent[];
  can_cancel: boolean;
  can_refund: boolean;
}

export type OrderSort = "date_desc" | "date_asc" | "total_desc" | "total_asc" | "earnings_desc";

export interface OrderFilters {
  q?: string;
  status?: OrderDisplayStatus;
  date_from?: string;
  date_to?: string;
  sort?: OrderSort;
}

export interface QueueItem {
  id: string;
  order_short_id: string;
  product_name: string;
  color: string | null;
  size: string | null;
  quantity: number;
  base_image_url: string | null;
  design_url: string | null;
  store_name: string | null;
  status: string;
  next_action: string | null;
  created_at: string;
}

export interface QueueOut {
  items: QueueItem[];
  to_produce: number;
  in_production: number;
  shipped: number;
}

/** Public buy-now — payment is the stub gateway (seam #3). */
export async function checkout(slug: string, payload: CheckoutPayload): Promise<CheckoutResult> {
  return (await api.post<CheckoutResult>(`/store/${slug}/checkout`, payload)).data;
}

export interface CartCheckoutPayload {
  items: { shop_item_id: string; color: string; size: string; quantity: number }[];
  name: string;
  email: string;
  address: string;
  city: string;
  postal: string;
  country: string;
  discount_code?: string | null;
}

/** Check out one brand's cart lines as a single multi-line order. */
export async function checkoutCart(slug: string, payload: CartCheckoutPayload): Promise<CheckoutResult> {
  return (await api.post<CheckoutResult>(`/store/${slug}/checkout-cart`, payload)).data;
}

export async function listOrders(filters: OrderFilters = {}): Promise<OrderList> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  return (await api.get<OrderList>("/orders", { params })).data;
}

export async function getOrder(id: string): Promise<OrderDetail> {
  return (await api.get<OrderDetail>(`/orders/${id}`)).data;
}

export async function cancelOrder(id: string): Promise<OrderDetail> {
  return (await api.post<OrderDetail>(`/orders/${id}/cancel`)).data;
}

export async function refundOrder(id: string): Promise<OrderDetail> {
  return (await api.post<OrderDetail>(`/orders/${id}/refund`)).data;
}

export async function getProductionQueue(): Promise<QueueOut> {
  return (await api.get<QueueOut>("/production/queue")).data;
}

export async function advanceProduction(itemId: string, trackingNumber?: string): Promise<QueueOut> {
  return (
    await api.post<QueueOut>(`/production/items/${itemId}/advance`, {
      tracking_number: trackingNumber || null,
    })
  ).data;
}
