import { api } from "./client";

export type StoreState = "DRAFT" | "LIVE";

/** socials map is keyed by the backend enum value, e.g. { INSTAGRAM: "https://…" }. */
export interface StorefrontState {
  brand_name: string | null;
  creator_name: string | null;
  description: string | null;
  slug: string | null;
  logo_url: string | null;
  cover_url: string | null;
  socials: Record<string, string>;
  store_state: StoreState;
  is_published: boolean;
  published_at: string | null;
}

export interface SocialLinksPayload {
  instagram?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
  youtube?: string | null;
  website?: string | null;
}

export interface StorefrontUpdate {
  brand_name?: string;
  creator_name?: string;
  description?: string;
  slug?: string;
  socials?: SocialLinksPayload;
}

export interface PublicStorefront {
  brand_name: string;
  creator_name: string | null;
  description: string | null;
  slug: string;
  logo_url: string | null;
  cover_url: string | null;
  socials: Record<string, string>;
  products: unknown[];
}

export async function getStorefront(): Promise<StorefrontState> {
  return (await api.get<StorefrontState>("/seller/storefront")).data;
}

export async function updateStorefront(update: StorefrontUpdate): Promise<StorefrontState> {
  return (await api.patch<StorefrontState>("/seller/storefront", update)).data;
}

function upload(path: string, file: File): Promise<StorefrontState> {
  const form = new FormData();
  form.append("file", file);
  return api.post<StorefrontState>(path, form).then((r) => r.data);
}

export const uploadLogo = (file: File) => upload("/seller/storefront/logo", file);
export const uploadCover = (file: File) => upload("/seller/storefront/cover", file);

export async function removeLogo(): Promise<StorefrontState> {
  return (await api.delete<StorefrontState>("/seller/storefront/logo")).data;
}

export async function removeCover(): Promise<StorefrontState> {
  return (await api.delete<StorefrontState>("/seller/storefront/cover")).data;
}

export async function publishStorefront(): Promise<StorefrontState> {
  return (await api.post<StorefrontState>("/seller/storefront/publish")).data;
}

export async function unpublishStorefront(): Promise<StorefrontState> {
  return (await api.post<StorefrontState>("/seller/storefront/unpublish")).data;
}

export async function getPublicStorefront(slug: string): Promise<PublicStorefront> {
  return (await api.get<PublicStorefront>(`/store/${slug}`)).data;
}
