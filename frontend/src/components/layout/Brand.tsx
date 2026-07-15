import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "../../lib/cn";

export function Brand({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="text-[15px] font-extrabold tracking-tight text-slate-900">
        MyHappiness<span className="text-brand-600">Club</span>
      </span>
    </Link>
  );
}
