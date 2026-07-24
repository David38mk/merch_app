import { api } from "./client";

export type ShopItemState = "LISTED" | "UNLISTED" | "PENDING" | "ARCHIVED";

export interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  price: string;
  production_cost: string;
  platform_fee: string;
  earnings: string;
  state: ShopItemState;
  base_item_id: string;
  base_name: string;
  base_image_url: string | null;
  design_id: string | null;
  design_url: string | null;
  provider: string | null;
  category: string | null;
  pos_x: number;
  pos_y: number;
  scale: number;
  rotation: number;
  created_at: string;
  updated_at: string;
  collaboration_id: string | null;
  color: string | null;
  size: string | null;
  material: string | null;
  print_type: string | null;
  print_area: string | null;
  /** Lowest price that still covers production + the platform fee. */
  min_price: string;
}

/** Everything the editor can change. Only the keys sent are touched. */
export interface ShopItemPatch {
  name?: string;
  description?: string;
  tags?: string[];
  price?: number;
  state?: ShopItemState;
  color?: string;
  size?: string;
  material?: string;
  print_type?: string;
  design_id?: string;
  print_area?: string;
  pos_x?: number;
  pos_y?: number;
  scale?: number;
  rotation?: number;
}

export interface Revision {
  id: string;
  summary: string[];
  created_at: string;
}

export interface ProductCounts {
  UNLISTED: number;
  LISTED: number;
  ARCHIVED: number;
  PENDING: number;
}

export interface ProductList {
  items: ShopItem[];
  /** Always over the whole catalogue, so tab badges stay right while filtering. */
  counts: ProductCounts;
  categories: string[];
}

export type ProductSort =
  | "updated_desc"
  | "created_desc"
  | "created_asc"
  | "price_desc"
  | "price_asc"
  | "name_asc";

export interface ProductFilters {
  q?: string;
  state?: ShopItemState;
  category?: string;
  created_from?: string;
  created_to?: string;
  sort?: ProductSort;
}

export interface ShopItemCreate {
  base_item_id: string;
  design_id: string;
  print_area?: string | null;
  pos_x: number;
  pos_y: number;
  scale: number;
  rotation: number;
  name: string;
  description?: string;
  tags: string[];
  price: number;
  color?: string | null;
  size?: string | null;
  material?: string | null;
  print_type?: string | null;
  publish: boolean;
}

export interface Commission {
  plan_code: string;
  commission_rate: number;
}

export interface ProductCopy {
  title: string;
  description: string;
  keywords: string[];
}

export async function getCommission(): Promise<Commission> {
  return (await api.get<Commission>("/shop-items/commission")).data;
}

export async function generateCopy(baseItemId: string): Promise<ProductCopy> {
  return (await api.post<ProductCopy>("/shop-items/ai-copy", { base_item_id: baseItemId })).data;
}

export async function listShopItems(filters: ProductFilters = {}): Promise<ProductList> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  return (await api.get<ProductList>("/shop-items", { params })).data;
}

export async function getShopItem(id: string): Promise<ShopItem> {
  return (await api.get<ShopItem>(`/shop-items/${id}`)).data;
}

export async function duplicateShopItem(id: string): Promise<ShopItem> {
  return (await api.post<ShopItem>(`/shop-items/${id}/duplicate`)).data;
}

export async function createShopItem(payload: ShopItemCreate): Promise<ShopItem> {
  return (await api.post<ShopItem>("/shop-items", payload)).data;
}

export async function updateShopItem(id: string, patch: ShopItemPatch): Promise<ShopItem> {
  return (await api.patch<ShopItem>(`/shop-items/${id}`, patch)).data;
}

export async function listRevisions(id: string): Promise<Revision[]> {
  return (await api.get<Revision[]>(`/shop-items/${id}/revisions`)).data;
}

export async function deleteShopItem(id: string): Promise<void> {
  await api.delete(`/shop-items/${id}`);
}
