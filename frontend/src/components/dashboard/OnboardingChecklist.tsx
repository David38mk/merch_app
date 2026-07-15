import { Check, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import type { ChecklistFlags } from "../../api/dashboard";
import { Card } from "../ui/Card";
import { cn } from "../../lib/cn";

interface Step {
  key: keyof ChecklistFlags;
  label: string;
  hint: string;
  href: string;
}

const STEPS: Step[] = [
  { key: "complete_profile", label: "Complete your profile", hint: "Brand name, country & currency", href: "/onboarding" },
  { key: "upload_logo", label: "Upload your logo", hint: "Make your storefront yours", href: "/seller/storefront" },
  { key: "create_product", label: "Create your first product", hint: "Pick a blank, add a design", href: "/seller/products" },
  { key: "publish_product", label: "Publish a product", hint: "List it on your storefront", href: "/seller/products" },
  { key: "publish_store", label: "Publish your store", hint: "Go live with a public URL", href: "/seller/storefront" },
];

export function OnboardingChecklist({ checklist }: { checklist: ChecklistFlags }) {
  const done = STEPS.filter((s) => checklist[s.key]).length;
  const allDone = done === STEPS.length;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Get set up</h2>
        <span className="text-sm text-slate-400">
          {done}/{STEPS.length}
        </span>
      </div>

      {allDone ? (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <Check className="h-4 w-4" strokeWidth={3} /> You're all set up — nice work!
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-500">Finish these to start selling.</p>
      )}

      <ul className="mt-4 space-y-1">
        {STEPS.map((s) => {
          const complete = checklist[s.key];
          return (
            <li key={s.key}>
              <Link
                to={s.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2.5 transition",
                  complete ? "opacity-60" : "hover:bg-slate-50",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
                    complete ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent",
                  )}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-medium", complete ? "text-slate-500 line-through" : "text-slate-800")}>
                    {s.label}
                  </span>
                  {!complete && <span className="block text-xs text-slate-400">{s.hint}</span>}
                </span>
                {!complete && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
