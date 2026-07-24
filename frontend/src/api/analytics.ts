import { api } from "./client";

export interface DayPoint {
  day: string;
  revenue: string;
  orders: number;
  visitors: number;
}

export interface CountryRow {
  country: string;
  revenue: string;
  orders: number;
}

export interface ProductRow {
  shop_item_id: string | null;
  name: string;
  revenue: string;
  units: number;
  conversion: number | null;
  rating: number | null;
}

export interface CategoryRow {
  category: string;
  revenue: string;
  units: number;
}

export interface Analytics {
  date_from: string;
  date_to: string;
  revenue: string;
  orders: number;
  visitors: number;
  conversion: number | null;
  avg_order_value: string | null;
  by_day: DayPoint[];
  by_country: CountryRow[];
  top_products: ProductRow[];
  top_categories: CategoryRow[];
}

export async function getAnalytics(dateFrom?: string, dateTo?: string): Promise<Analytics> {
  const params: Record<string, string> = {};
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  return (await api.get<Analytics>("/seller/analytics", { params })).data;
}
