import { Check, X } from "lucide-react";

import { cn } from "../../lib/cn";
import { passwordChecks } from "../../lib/password";

export function PasswordChecklist({ pw }: { pw: string }) {
  return (
    <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-3">
      {passwordChecks(pw).map((c) => (
        <li
          key={c.label}
          className={cn("flex items-center gap-1.5 text-xs", c.ok ? "text-emerald-600" : "text-slate-400")}
        >
          {c.ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" />}
          {c.label}
        </li>
      ))}
    </ul>
  );
}
