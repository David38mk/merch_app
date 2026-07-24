import { api } from "./client";

export type CollabStage =
  | "PENDING"
  | "DESIGNER_STARTED"
  | "FIRST_DRAFT_SUBMITTED"
  | "REVISION_REQUESTED"
  | "UPDATED_DESIGN_SUBMITTED"
  | "DRAFT_APPROVED"
  | "SELLER_REVIEWING"
  | "FINAL_APPROVAL"
  | "PAYMENT_PENDING"
  | "COMPLETED";

export type CollabEventType =
  | "CREATED"
  | "STARTED"
  | "DRAFT_SUBMITTED"
  | "REVISION_REQUESTED"
  | "DRAFT_APPROVED"
  | "FINAL_SUBMITTED"
  | "APPROVED"
  | "PAYMENT_COMPLETED"
  | "PRODUCT_CREATED"
  | "COMPLETED";

export type SubmissionKind = "PREVIEW" | "FINAL";
export type SubmissionDecision = "PENDING" | "ACCEPTED" | "DECLINED";

export interface Party {
  name: string;
  avatar_url: string | null;
  slug?: string | null;
}

export interface CollabEvent {
  id: string;
  type: CollabEventType;
  note: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface CollabSubmission {
  id: string;
  kind: SubmissionKind;
  resource_url: string | null;
  decision: SubmissionDecision;
  feedback: string | null;
  created_at: string;
}

export interface CollabMessage {
  id: string;
  body: string;
  mine: boolean;
  sender_name: string;
  created_at: string;
}

export interface Collaboration {
  id: string;
  state: string;
  stage: CollabStage;
  my_role: "seller" | "designer";
  title: string;
  brief: string | null;
  deadline: string | null;
  payment_type: "FIXED" | "PERCENT" | "BOTH" | null;
  agreed_price_amount: string | null;
  agreed_percent: string | null;
  needs_payment: boolean;
  paid: boolean;
  base_name: string | null;
  base_image_url: string | null;
  seller: Party;
  designer: Party;
  shop_item_id: string | null;
  submissions: CollabSubmission[];
  events: CollabEvent[];
  created_at: string;
}

export interface CollabListItem {
  id: string;
  title: string;
  stage: CollabStage;
  my_role: "seller" | "designer";
  counterpart: string;
  base_image_url: string | null;
  deadline: string | null;
  created_at: string;
}

export async function listCollaborations(): Promise<CollabListItem[]> {
  return (await api.get<CollabListItem[]>("/collaborations")).data;
}

export async function getCollaboration(id: string): Promise<Collaboration> {
  return (await api.get<Collaboration>(`/collaborations/${id}`)).data;
}

export async function startWork(id: string): Promise<Collaboration> {
  return (await api.post<Collaboration>(`/collaborations/${id}/start`)).data;
}

export async function submitWork(
  id: string,
  file: File,
  kind: SubmissionKind,
  note?: string,
): Promise<Collaboration> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  if (note) form.append("note", note);
  return (await api.post<Collaboration>(`/collaborations/${id}/submissions`, form)).data;
}

export async function approveSubmission(id: string, submissionId: string): Promise<Collaboration> {
  return (await api.post<Collaboration>(`/collaborations/${id}/submissions/${submissionId}/approve`)).data;
}

export async function requestRevision(
  id: string,
  submissionId: string,
  feedback: string,
): Promise<Collaboration> {
  return (await api.post<Collaboration>(`/collaborations/${id}/submissions/${submissionId}/revise`, { feedback }))
    .data;
}

export async function completePayment(id: string): Promise<Collaboration> {
  return (await api.post<Collaboration>(`/collaborations/${id}/pay`)).data;
}

export async function listMessages(id: string): Promise<CollabMessage[]> {
  return (await api.get<CollabMessage[]>(`/collaborations/${id}/messages`)).data;
}

export async function postMessage(id: string, body: string): Promise<CollabMessage> {
  return (await api.post<CollabMessage>(`/collaborations/${id}/messages`, { body })).data;
}
