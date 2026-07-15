import { api } from "./client";

export interface BaseItem {
  id: string;
  name: string;
  description: string | null;
  base_price: string | number;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export async function listBaseItems(): Promise<BaseItem[]> {
  return (await api.get<BaseItem[]>("/catalog/base-items")).data;
}

export async function listCategories(): Promise<Category[]> {
  return (await api.get<Category[]>("/catalog/categories")).data;
}

export async function createBaseItem(input: {
  name: string;
  description?: string;
  base_price: number;
}): Promise<BaseItem> {
  return (await api.post<BaseItem>("/catalog/base-items", input)).data;
}
