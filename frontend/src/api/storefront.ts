import { api } from "./client";

export type StoreState = "DRAFT" | "LIVE";
export type ButtonStyle = "rounded" | "pill" | "square";

export interface Theme {
  primary: string;
  accent: string;
  button_style: ButtonStyle;
}

export interface Curation {
  order: string[];
  hidden: string[];
  featured: string[];
}

/** The editable storefront config (draft merged over published). */
export interface StorefrontConfig {
  brand_name: string | null;
  creator_name: string | null;
  description: string | null;
  slug: string | null;
  logo_url: string | null;
  cover_url: string | null;
  contact_email: string | null;
  location: string | null;
  socials: Record<string, string>;
  theme: Theme;
  curation: Curation;
}

export interface BuilderProduct {
  id: string;
  name: string;
  price: string;
  base_image_url: string | null;
  design_url: string | null;
  pos_x: number;
  pos_y: number;
  scale: number;
  rotation: number;
}

/** Derived on the server from store_state + published_at — never stored. */
export type PublishStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";

export interface SlugCheck {
  slug: string;
  available: boolean;
  reason: string | null;
  suggestion: string | null;
}

export interface StorefrontState {
  config: StorefrontConfig;
  has_unpublished_changes: boolean;
  store_state: StoreState;
  is_published: boolean;
  published_at: string | null;
  products: BuilderProduct[];
  status: PublishStatus;
  /** Absolute when a public domain is configured, else app-relative (/store/x). */
  store_url: string | null;
  pending_slug: string | null;
  slug_check: SlugCheck | null;
  last_published_at: string | null;
  version: number;
  /** Empty = ready to publish. */
  blockers: string[];
}

export interface SocialLinksPayload {
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  facebook?: string | null;
  x?: string | null;
  website?: string | null;
}

export interface StorefrontDraftUpdate {
  brand_name?: string;
  creator_name?: string;
  description?: string;
  slug?: string;
  contact_email?: string;
  location?: string;
  socials?: SocialLinksPayload;
  theme?: Partial<Theme>;
  curation?: Curation;
}

export interface PublicProduct {
  id: string;
  name: string;
  price: string;
  category: string | null;
  /** In-stock colour/size combos for the buy-now dialog. */
  variants: { color: string; size: string }[];
  base_image_url: string | null;
  design_url: string | null;
  pos_x: number;
  pos_y: number;
  scale: number;
  rotation: number;
  featured: boolean;
}

export interface PublicStorefront {
  brand_name: string;
  creator_name: string | null;
  description: string | null;
  slug: string;
  logo_url: string | null;
  cover_url: string | null;
  contact_email: string | null;
  location: string | null;
  socials: Record<string, string>;
  theme: Theme;
  products: PublicProduct[];
}

export async function getStorefront(): Promise<StorefrontState> {
  return (await api.get<StorefrontState>("/seller/storefront")).data;
}

/** Autosave — writes to the draft only; the live page is untouched. */
export async function saveDraft(update: StorefrontDraftUpdate): Promise<StorefrontState> {
  return (await api.patch<StorefrontState>("/seller/storefront", update)).data;
}

export async function discardDraft(): Promise<StorefrontState> {
  return (await api.post<StorefrontState>("/seller/storefront/discard")).data;
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

/** Is this store URL free? Called while the seller types. */
export async function checkSlug(slug: string): Promise<SlugCheck> {
  return (await api.get<SlugCheck>("/seller/storefront/slug-check", { params: { slug } })).data;
}

/** The draft rendered exactly as buyers would see it, for the pre-publish preview. */
export async function getStorefrontPreview(): Promise<PublicStorefront> {
  return (await api.get<PublicStorefront>("/seller/storefront/preview")).data;
}

/** Turns an app-relative store_url into something a seller can copy and share. */
export function absoluteStoreUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${window.location.origin}${url}`;
}
