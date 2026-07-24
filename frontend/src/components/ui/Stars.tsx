import { Star } from "lucide-react";

import { cn } from "../../lib/cn";

/** Read-only 5-star rating. Renders muted when there's nothing to show yet. */
export function Stars({
  value,
  count,
  size = "sm",
}: {
  value: number | null;
  count?: number;
  size?: "sm" | "md";
}) {
  const px = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  if (value === null) {
    return <span className="text-xs text-slate-400">No reviews yet</span>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(px, i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-300")}
          />
        ))}
      </span>
      <span className="text-xs font-medium text-slate-600">{value.toFixed(1)}</span>
      {count !== undefined && <span className="text-xs text-slate-400">({count})</span>}
    </span>
  );
}

/** "45m" / "~6h" / "~2d" — how fast a designer typically responds. */
export function formatResponse(hours: number | null): string | null {
  if (hours === null || hours === undefined) return null;
  if (hours < 1) return "under 1h";
  if (hours < 48) return `~${Math.round(hours)}h`;
  return `~${Math.round(hours / 24)}d`;
}
