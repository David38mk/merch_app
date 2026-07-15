import { api } from "./client";

export interface ChecklistFlags {
  complete_profile: boolean;
  upload_logo: boolean;
  create_product: boolean;
  publish_product: boolean;
  publish_store: boolean;
}

export interface StorefrontMini {
  is_published: boolean;
  slug: string | null;
  store_name: string | null;
  has_logo: boolean;
}

export interface DashboardStats {
  products: number;
  live_products: number;
  orders: number;
  ai_credits: number;
  currency: string | null;
}

export interface SellerDashboard {
  first_name: string;
  display_name: string;
  checklist: ChecklistFlags;
  steps_done: number;
  steps_total: number;
  is_active: boolean;
  storefront: StorefrontMini;
  stats: DashboardStats;
}

export async function getSellerDashboard(): Promise<SellerDashboard> {
  return (await api.get<SellerDashboard>("/seller/dashboard")).data;
}
