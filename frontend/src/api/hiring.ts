import { api } from "./client";

export type CallStatus = "DRAFT" | "OPEN" | "AWARDED" | "CLOSED";
export type PaymentType = "FIXED" | "PERCENT" | "BOTH";
export type AttachmentKind = "REFERENCE" | "BRAND_GUIDELINE";
export type BidStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

/** Derived 7-state status shown in the hub (computed server-side). */
export type JobStatus =
  | "DRAFT"
  | "OPEN"
  | "IN_REVIEW"
  | "DESIGNER_SELECTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CLOSED";

export interface DesignerBrief {
  id: string;
  display_name: string;
  slug: string;
  avatar_url: string | null;
  bio: string | null;
  rating_avg: number | null;
  rating_count: number;
  completed_jobs: number;
  response_hours: number | null;
  portfolio_preview: string[];
}

export interface ProjectBrief {
  id: string;
  title: string;
  cover_url: string | null;
  categories: string[];
}

export interface Bid {
  id: string;
  price_amount: string | null;
  percent: string | null;
  intro: string | null;
  message: string;
  status: BidStatus;
  created_at: string;
  designer: DesignerBrief;
  projects: ProjectBrief[];
}

export interface CallAttachment {
  id: string;
  url: string;
  kind: AttachmentKind;
}

export interface DesignerCall {
  id: string;
  title: string;
  brief: string;
  design_style: string | null;
  inspiration_notes: string | null;
  payment_type: PaymentType;
  budget_amount: string | null;
  revenue_share_percent: string | null;
  deadline: string | null;
  desired_launch_date: string | null;
  status: CallStatus;
  display_status: JobStatus;
  can_delete: boolean;
  has_applied: boolean;
  published_at: string | null;
  collaboration_id: string | null;
  base_item_id: string | null;
  base_name: string | null;
  base_category: string | null;
  base_image_url: string | null;
  provider: string | null;
  seller_brand: string | null;
  seller_slug: string | null;
  seller_logo: string | null;
  my_bid: Bid | null;
  attachments: CallAttachment[];
  bids_count: number;
  editable: boolean;
  created_at: string;
}

export interface CallInput {
  base_item_id: string;
  title: string;
  brief: string;
  design_style?: string | null;
  inspiration_notes?: string | null;
  payment_type: PaymentType;
  budget_amount?: number | null;
  revenue_share_percent?: number | null;
  deadline?: string | null;
  desired_launch_date?: string | null;
  publish: boolean;
}

export type CallPatch = Partial<Omit<CallInput, "base_item_id">>;

export async function listMyCalls(): Promise<DesignerCall[]> {
  return (await api.get<DesignerCall[]>("/designer-calls")).data;
}

export async function listMarketplace(): Promise<DesignerCall[]> {
  return (await api.get<DesignerCall[]>("/designer-calls/marketplace")).data;
}

export async function getCall(id: string): Promise<DesignerCall> {
  return (await api.get<DesignerCall>(`/designer-calls/${id}`)).data;
}

export async function createCall(input: CallInput): Promise<DesignerCall> {
  return (await api.post<DesignerCall>("/designer-calls", input)).data;
}

export async function updateCall(id: string, patch: CallPatch): Promise<DesignerCall> {
  return (await api.patch<DesignerCall>(`/designer-calls/${id}`, patch)).data;
}

export async function deleteCall(id: string): Promise<void> {
  await api.delete(`/designer-calls/${id}`);
}

export async function uploadAttachment(callId: string, file: File, kind: AttachmentKind): Promise<CallAttachment> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  return (await api.post<CallAttachment>(`/designer-calls/${callId}/attachments`, form)).data;
}

export async function deleteAttachment(callId: string, attachmentId: string): Promise<void> {
  await api.delete(`/designer-calls/${callId}/attachments/${attachmentId}`);
}

export async function closeCall(id: string): Promise<DesignerCall> {
  return (await api.post<DesignerCall>(`/designer-calls/${id}/close`)).data;
}

export async function duplicateCall(id: string): Promise<DesignerCall> {
  return (await api.post<DesignerCall>(`/designer-calls/${id}/duplicate`)).data;
}

// ── applications ───────────────────────────────────────────────────────────────

export async function listBids(callId: string): Promise<Bid[]> {
  return (await api.get<Bid[]>(`/designer-calls/${callId}/bids`)).data;
}

export async function submitBid(
  callId: string,
  input: {
    price_amount?: number | null;
    percent?: number | null;
    intro?: string | null;
    message: string;
    project_ids?: string[];
  },
): Promise<Bid> {
  return (await api.post<Bid>(`/designer-calls/${callId}/bids`, input)).data;
}

export async function acceptBid(callId: string, bidId: string): Promise<DesignerCall> {
  return (await api.post<DesignerCall>(`/designer-calls/${callId}/bids/${bidId}/accept`)).data;
}

export async function rejectBid(callId: string, bidId: string): Promise<Bid> {
  return (await api.post<Bid>(`/designer-calls/${callId}/bids/${bidId}/reject`)).data;
}
