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

// ── portfolio projects ────────────────────────────────────────────────────────

export interface ProjectImage {
  id: string;
  image_url: string;
  position: number;
}

export interface DesignerProject {
  id: string;
  title: string;
  description: string | null;
  categories: string[];
  featured: boolean;
  published: boolean;
  created_at: string;
  cover_url: string | null;
  images: ProjectImage[];
}

export interface ProjectInput {
  title: string;
  description?: string | null;
  categories?: string[];
}

export interface ProjectPatch {
  title?: string;
  description?: string | null;
  categories?: string[];
  featured?: boolean;
}

export async function getProjects(): Promise<DesignerProject[]> {
  return (await api.get<DesignerProject[]>("/designer/projects")).data;
}

export async function createProject(input: ProjectInput): Promise<DesignerProject> {
  return (await api.post<DesignerProject>("/designer/projects", input)).data;
}

export async function updateProject(id: string, patch: ProjectPatch): Promise<DesignerProject> {
  return (await api.patch<DesignerProject>(`/designer/projects/${id}`, patch)).data;
}

export async function setProjectPublished(id: string, published: boolean): Promise<DesignerProject> {
  return (await api.post<DesignerProject>(`/designer/projects/${id}/publish`, null, { params: { published } })).data;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/designer/projects/${id}`);
}

export async function addProjectImage(id: string, file: File): Promise<DesignerProject> {
  const form = new FormData();
  form.append("file", file);
  return (await api.post<DesignerProject>(`/designer/projects/${id}/images`, form)).data;
}

export async function deleteProjectImage(id: string, imageId: string): Promise<DesignerProject> {
  return (await api.delete<DesignerProject>(`/designer/projects/${id}/images/${imageId}`)).data;
}

export async function reorderProjectImages(id: string, imageIds: string[]): Promise<DesignerProject> {
  return (await api.post<DesignerProject>(`/designer/projects/${id}/reorder`, { image_ids: imageIds })).data;
}
