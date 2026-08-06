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

// ── canonical project timeline (the 7-stage status tracker) ───────────────────

export const COLLAB_STEPS = [
  "Accepted",
  "Working",
  "Draft submitted",
  "Revision requested",
  "Updated draft",
  "Final approval",
  "Completed",
] as const;

// Where each backend stage sits on the 7-step spine.
const STAGE_STEP: Record<CollabStage, number> = {
  PENDING: 0,
  DESIGNER_STARTED: 1,
  FIRST_DRAFT_SUBMITTED: 2,
  REVISION_REQUESTED: 3,
  UPDATED_DESIGN_SUBMITTED: 4,
  DRAFT_APPROVED: 5,
  SELLER_REVIEWING: 5,
  FINAL_APPROVAL: 5,
  PAYMENT_PENDING: 5,
  COMPLETED: 6,
};

export type StepStatus = "done" | "current" | "upcoming" | "skipped";

/**
 * Per-step status for the tracker. The revision pair (steps 3–4) is optional —
 * if no revision ever happened it renders "skipped" rather than falsely ticked.
 */
export function stepStatuses(stage: CollabStage, revisionHappened: boolean): StepStatus[] {
  const cur = STAGE_STEP[stage] ?? 0;
  const done = stage === "COMPLETED";
  return COLLAB_STEPS.map((_, i) => {
    const optional = i === 3 || i === 4;
    if (optional && !revisionHappened) return "skipped";
    if (i < cur) return "done";
    if (i === cur) return done ? "done" : "current";
    return "upcoming";
  });
}
