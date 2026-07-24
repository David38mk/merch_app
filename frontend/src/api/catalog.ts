import { api } from "./client";

export interface Category {
  id: string;
  name: string;
}

export interface Provider {
  id: string;
  name: string;
}

export interface Facets {
  categories: Category[];
  providers: Provider[];
  colors: string[];
  materials: string[];
  print_methods: string[];
  price_min: number;
  price_max: number;
}

export interface BaseItemCard {
  id: string;
  name: string;
  base_price: string;
  image_url: string | null;
  provider: string;
  provider_id: string;
  category: string | null;
  category_id: string | null;
  colors: string[];
  print_areas: string[];
  materials: string[];
  print_methods: string[];
  available: boolean;
  is_favorite: boolean;
}

export interface Variant {
  size: string;
  color: string;
  price_delta: string;
  is_available: boolean;
}

export interface PrintOptionItem {
  kind: "MATERIAL" | "PRINT_TYPE";
  name: string;
  price_delta: string;
}

export interface BaseItemDetail extends BaseItemCard {
  description: string | null;
  production_time: string | null;
  sizes: string[];
  variants: Variant[];
  print_options: PrintOptionItem[];
}

export interface CatalogPage {
  total: number;
  page: number;
  page_size: number;
  items: BaseItemCard[];
}

export interface CatalogQuery {
  search?: string;
  category_id?: string;
  provider_id?: string;
  color?: string;
  material?: string;
  print_method?: string;
  min_price?: number;
  max_price?: number;
  available_only?: boolean;
  favorites_only?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "name";
  page?: number;
  page_size?: number;
}

export async function getFacets(): Promise<Facets> {
  return (await api.get<Facets>("/catalog/facets")).data;
}

export async function getCatalog(q: CatalogQuery): Promise<CatalogPage> {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null && v !== "" && v !== false) params[k] = String(v);
  }
  return (await api.get<CatalogPage>("/catalog/base-items", { params })).data;
}

export async function getBaseItem(id: string): Promise<BaseItemDetail> {
  return (await api.get<BaseItemDetail>(`/catalog/base-items/${id}`)).data;
}

export async function favoriteItem(id: string): Promise<{ is_favorite: boolean }> {
  return (await api.post(`/catalog/base-items/${id}/favorite`)).data;
}

export async function unfavoriteItem(id: string): Promise<{ is_favorite: boolean }> {
  return (await api.delete(`/catalog/base-items/${id}/favorite`)).data;
}

export async function listCategories(): Promise<Category[]> {
  return (await api.get<Category[]>("/catalog/categories")).data;
}

/** Back-compat: a flat list of active blanks (used by the landing page + print-shop catalog). */
export async function listBaseItems(): Promise<BaseItemCard[]> {
  return (await getCatalog({ page_size: 48 })).items;
}

export async function createBaseItem(input: {
  name: string;
  description?: string;
  base_price: number;
}): Promise<{ id: string; name: string }> {
  return (await api.post("/catalog/base-items", input)).data;
}
