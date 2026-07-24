import type { Tone } from "../components/ui/Badge";
import type { PublishStatus } from "../api/storefront";

/** One place that decides how each publishing status looks and reads, so the
 * builder, the studio card and any future surface can never describe it differently. */
export const PUBLISH_STATUS: Record<
  PublishStatus,
  { label: string; tone: Tone; dot: string; hint: string }
> = {
  DRAFT: {
    label: "Draft",
    tone: "slate",
    dot: "bg-slate-400",
    hint: "Not visible to anyone yet. Publish to get your public URL.",
  },
  PUBLISHED: {
    label: "Published",
    tone: "green",
    dot: "bg-emerald-500",
    hint: "Live — customers can browse and buy right now.",
  },
  UNPUBLISHED: {
    label: "Unpublished",
    tone: "amber",
    dot: "bg-amber-500",
    hint: "Taken offline. Your content is kept — republish to bring it back.",
  },
};
