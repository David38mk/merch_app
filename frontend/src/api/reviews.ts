import { api } from "./client";

export interface Review {
  id: string;
  reviewer_name: string;
  rating: number;
  title: string;
  body: string;
  photos: string[];
  created_at: string;
  mine: boolean;
  can_report: boolean;
}

export interface ReviewSummary {
  average: number;
  count: number;
  breakdown: Record<string, number>; // { "5": n, … "1": n }
}

export interface ProductReviews {
  summary: ReviewSummary;
  photos: string[];
  items: Review[];
}

export interface ReviewEligibility {
  can_review: boolean;
  reason: string | null;
  has_review: boolean;
  review: Review | null;
}

export interface ReviewInput {
  shop_item_id: string;
  rating: number;
  title: string;
  body: string;
  photo_urls: string[];
}

export async function getProductReviews(productId: string): Promise<ProductReviews> {
  return (await api.get<ProductReviews>(`/marketplace/products/${productId}/reviews`)).data;
}

export async function getReviewEligibility(shopItemId: string): Promise<ReviewEligibility> {
  return (await api.get<ReviewEligibility>("/buyer/reviews/eligibility", { params: { shop_item_id: shopItemId } })).data;
}

export async function uploadReviewPhoto(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  return (await api.post<{ url: string }>("/buyer/reviews/photo", form)).data.url;
}

export async function submitReview(input: ReviewInput): Promise<Review> {
  return (await api.post<Review>("/buyer/reviews", input)).data;
}

export async function deleteReview(id: string): Promise<void> {
  await api.delete(`/buyer/reviews/${id}`);
}

export async function reportReview(id: string, reason?: string): Promise<{ reported: boolean; hidden: boolean }> {
  return (await api.post<{ reported: boolean; hidden: boolean }>(`/reviews/${id}/report`, { reason: reason ?? null })).data;
}
