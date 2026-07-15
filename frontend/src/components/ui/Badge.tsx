import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export type Tone = "brand" | "slate" | "green" | "amber";

const tones: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700",
  slate: "bg-slate-100 text-slate-600",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
};

export function Badge({ tone = "brand", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
