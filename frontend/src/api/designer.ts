import { api } from "./client";

export interface PortfolioItem {
  id: string;
  image_url: string;
}

export interface DesignerOnboarding {
  display_name: string;
  bio: string | null;
  country: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  skills: string[];
  experience: string | null;
  portfolio_links: string[];
  portfolio_items: PortfolioItem[];
  website: string | null;
  behance: string | null;
  dribbble: string | null;
  instagram: string | null;
  onboarding_completed: boolean;
}

export interface OnboardingOptions {
  skills: string[];
  experience: string[];
}

export interface DesignerProfilePatch {
  display_name?: string;
  bio?: string | null;
  country?: string | null;
  skills?: string[];
  experience?: string | null;
  portfolio_links?: string[];
  website?: string | null;
  behance?: string | null;
  dribbble?: string | null;
  instagram?: string | null;
}

export async function getOnboardingOptions(): Promise<OnboardingOptions> {
  return (await api.get<OnboardingOptions>("/designer/onboarding/options")).data;
}

export async function getDesignerOnboarding(): Promise<DesignerOnboarding> {
  return (await api.get<DesignerOnboarding>("/designer/onboarding")).data;
}

export async function patchDesignerProfile(patch: DesignerProfilePatch): Promise<DesignerOnboarding> {
  return (await api.patch<DesignerOnboarding>("/designer/profile", patch)).data;
}

export async function uploadDesignerAvatar(file: File): Promise<DesignerOnboarding> {
  const form = new FormData();
  form.append("file", file);
  return (await api.post<DesignerOnboarding>("/designer/avatar", form)).data;
}

export async function uploadDesignerCover(file: File): Promise<DesignerOnboarding> {
  const form = new FormData();
  form.append("file", file);
  return (await api.post<DesignerOnboarding>("/designer/cover", form)).data;
}

export async function addPortfolioImage(file: File): Promise<PortfolioItem> {
  const form = new FormData();
  form.append("file", file);
  return (await api.post<PortfolioItem>("/designer/portfolio", form)).data;
}

export async function removePortfolioImage(id: string): Promise<void> {
  await api.delete(`/designer/portfolio/${id}`);
}

export async function completeOnboarding(): Promise<DesignerOnboarding> {
  return (await api.post<DesignerOnboarding>("/designer/onboarding/complete")).data;
}
