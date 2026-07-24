import type { CollabEventType, CollabStage } from "../api/collaborations";
import type { Tone } from "../components/ui/Badge";

const STAGE: Record<CollabStage, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "slate" },
  DESIGNER_STARTED: { label: "Designer started", tone: "brand" },
  FIRST_DRAFT_SUBMITTED: { label: "First draft submitted", tone: "amber" },
  REVISION_REQUESTED: { label: "Revision requested", tone: "amber" },
  UPDATED_DESIGN_SUBMITTED: { label: "Updated design submitted", tone: "amber" },
  DRAFT_APPROVED: { label: "Draft approved", tone: "brand" },
  SELLER_REVIEWING: { label: "Seller reviewing", tone: "amber" },
  FINAL_APPROVAL: { label: "Final approval", tone: "green" },
  PAYMENT_PENDING: { label: "Payment pending", tone: "amber" },
  COMPLETED: { label: "Completed", tone: "green" },
};

export function stageMeta(s: CollabStage) {
  return STAGE[s] ?? { label: s, tone: "slate" as Tone };
}

const EVENT: Record<CollabEventType, string> = {
  CREATED: "Collaboration created",
  STARTED: "Designer started working",
  DRAFT_SUBMITTED: "Draft submitted",
  REVISION_REQUESTED: "Revision requested",
  DRAFT_APPROVED: "Draft approved",
  FINAL_SUBMITTED: "Final design submitted",
  APPROVED: "Final design approved",
  PAYMENT_COMPLETED: "Payment completed",
  PRODUCT_CREATED: "Draft product created",
  COMPLETED: "Collaboration completed",
};

export function eventLabel(t: CollabEventType): string {
  return EVENT[t] ?? t;
}
