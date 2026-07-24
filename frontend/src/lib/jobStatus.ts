import type { JobStatus } from "../api/hiring";
import type { Tone } from "../components/ui/Badge";

export const JOB_STATUSES: JobStatus[] = [
  "DRAFT",
  "OPEN",
  "IN_REVIEW",
  "DESIGNER_SELECTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CLOSED",
];

const META: Record<JobStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "slate" },
  OPEN: { label: "Open", tone: "brand" },
  IN_REVIEW: { label: "In review", tone: "amber" },
  DESIGNER_SELECTED: { label: "Designer selected", tone: "green" },
  IN_PROGRESS: { label: "In progress", tone: "brand" },
  COMPLETED: { label: "Completed", tone: "green" },
  CLOSED: { label: "Closed", tone: "slate" },
};

export function jobStatusMeta(s: JobStatus) {
  return META[s] ?? { label: s, tone: "slate" as Tone };
}
