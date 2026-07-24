import { api } from "./client";

export interface DesignerProfile {
  id: string;
  display_name: string;
  slug: string;
  bio: string | null;
  avatar_url: string | null;
}

export async function getMyDesignerProfile(): Promise<DesignerProfile | null> {
  return (await api.get<DesignerProfile | null>("/designer/me")).data;
}

/** Adds the DESIGNER role + profile to the current account. Idempotent. */
export async function enableDesigner(): Promise<DesignerProfile> {
  return (await api.post<DesignerProfile>("/designer/enable")).data;
}

export interface DesignerReview {
  id: string;
  reviewer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface PortfolioPiece {
  id: string;
  resource_url: string;
  source: string;
  created_at: string;
}

export interface DesignerPublicProfile {
  id: string;
  slug: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  rating_avg: number | null;
  rating_count: number;
  completed_jobs: number;
  response_hours: number | null;
  reviews: DesignerReview[];
  portfolio: PortfolioPiece[];
}

export async function getDesignerProfile(slug: string): Promise<DesignerPublicProfile> {
  return (await api.get<DesignerPublicProfile>(`/designers/${slug}`)).data;
}
