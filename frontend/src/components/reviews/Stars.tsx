import { Star } from "lucide-react";
import { useState } from "react";

import { cn } from "../../lib/cn";

/** Read-only star row. `value` may be fractional (e.g. 4.3) — stars fill by
 * rounding to the nearest whole for a clean, honest read. */
export function Stars({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  const rounded = Math.round(value);
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={n <= rounded ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}
        />
      ))}
    </span>
  );
}

/** Interactive star picker for the review form. */
export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className="p-0.5"
        >
          <Star className={cn("h-7 w-7 transition", n <= shown ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200")} />
        </button>
      ))}
    </div>
  );
}
