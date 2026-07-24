import { api } from "./client";

export interface ProductCard {
  id: string;
  name: string;
  price: string;
  category: string | null;
  base_image_url: string | null;
  design_url: string | null;
  pos_x: number;
  pos_y: number;
  scale: number;
  rotation: number;
  store_name: string;
  store_slug: string;
}

export interface BrandCard {
  slug: string;
  name: string;
  logo_url: string | null;
  cover_url: string | null;
  product_count: number;
  sample_images: string[];
}

export interface CategoryTile {
  name: string;
  slug: string;
  count: number;
  image_url: string | null;
}

export interface Hero {
  headline: string;
  subtext: string;
  cta_label: string;
  cta_href: string;
  brand: BrandCard | null;
  product: ProductCard | null;
}

export interface MarketplaceHome {
  hero: Hero;
  featured_products: ProductCard[];
  trending_brands: BrandCard[];
  categories: CategoryTile[];
  new_arrivals: ProductCard[];
}

export interface ProductListResult {
  items: ProductCard[];
  total: number;
}

export interface BrandFacet {
  slug: string;
  name: string;
  count: number;
}

export interface Facets {
  categories: CategoryTile[];
  brands: BrandFacet[];
  colors: string[];
  sizes: string[];
  price_min: number;
  price_max: number;
}

export async function getMarketplaceHome(): Promise<MarketplaceHome> {
  return (await api.get<MarketplaceHome>("/marketplace/home")).data;
}

export interface ProductQuery {
  category?: string;
  q?: string;
  brand?: string[];
  color?: string[];
  size?: string[];
  price_min?: number;
  price_max?: number;
  sort?: "popular" | "newest" | "price_asc" | "price_desc";
  limit?: number;
  offset?: number;
}

export async function getMarketplaceProducts(params: ProductQuery): Promise<ProductListResult> {
  return (
    await api.get<ProductListResult>("/marketplace/products", {
      params,
      // Repeat array keys as `brand=a&brand=b` (FastAPI list[str]) instead of `brand[]=`.
      paramsSerializer: { indexes: null },
    })
  ).data;
}

export async function getMarketplaceFacets(): Promise<Facets> {
  return (await api.get<Facets>("/marketplace/facets")).data;
}

export interface ProductVariant {
  color: string;
  size: string;
  available: boolean;
}

export interface ProductDetail {
  id: string;
  name: string;
  price: string;
  description: string | null;
  category: string | null;
  brand: { slug: string; name: string; logo_url: string | null };
  base_image_url: string | null;
  design_url: string | null;
  pos_x: number;
  pos_y: number;
  scale: number;
  rotation: number;
  colors: string[];
  sizes: string[];
  variants: ProductVariant[];
  materials: string[];
  print_methods: string[];
  production_time: string | null;
  related: ProductCard[];
}

export async function getProductDetail(id: string): Promise<ProductDetail> {
  return (await api.get<ProductDetail>(`/marketplace/products/${id}`)).data;
}

export interface DiscountValidation {
  valid: boolean;
  amount: string;
  kind: string | null;
  message: string | null;
  discount: string;
  shipping: string;
  tax: string;
  total: string;
}

export async function validateDiscount(code: string, slug: string, subtotal: number): Promise<DiscountValidation> {
  return (await api.post<DiscountValidation>("/marketplace/discount/validate", { code, slug, subtotal })).data;
}

export interface ShippingMethod {
  id: string;
  label: string;
  estimate: string;
  cost: string;
  free: boolean;
}

export async function getShippingMethods(subtotal: number): Promise<ShippingMethod[]> {
  return (await api.get<ShippingMethod[]>("/marketplace/shipping-methods", { params: { subtotal } })).data;
}

export interface ConfirmationItem {
  name: string;
  color: string | null;
  size: string | null;
  quantity: number;
  unit_price: string;
  base_image_url: string | null;
  design_url: string | null;
  pos_x: number;
  pos_y: number;
  scale: number;
  rotation: number;
}

export interface OrderConfirmation {
  short_id: string;
  created_at: string;
  email: string | null;
  store_name: string | null;
  store_slug: string | null;
  items: ConfirmationItem[];
  ship_name: string | null;
  ship_phone: string | null;
  ship_address: string | null;
  ship_city: string | null;
  ship_postal: string | null;
  ship_country: string | null;
  shipping_method: string | null;
  shipping_estimate: string | null;
  subtotal: string;
  discount_amount: string;
  discount_code: string | null;
  shipping_amount: string;
  tax_amount: string;
  total: string;
}

export async function getOrderConfirmation(token: string): Promise<OrderConfirmation> {
  return (await api.get<OrderConfirmation>("/marketplace/order-confirmation", { params: { token } })).data;
}
