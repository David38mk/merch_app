import { BarChart3, Store, Users, Wand2, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Card } from "../ui/Card";
import { cn } from "../../lib/cn";

interface Action {
  label: string;
  icon: LucideIcon;
  to?: string; // omitted → not built yet (disabled)
  soon?: boolean;
}

const ACTIONS: Action[] = [
  { label: "Create product", icon: Wand2, to: "/seller/products" },
  { label: "Edit store", icon: Store, to: "/seller/storefront" },
  { label: "Hire a designer", icon: Users, to: "/seller/hiring" },
  { label: "Analytics", icon: BarChart3, soon: true },
];

function Tile({ a }: { a: Action }) {
  const body = (
    <div
      className={cn(
        "group flex flex-col items-start gap-2 rounded-xl border border-slate-200 p-4 transition",
        a.to ? "bg-white hover:border-brand-300 hover:shadow-pop" : "cursor-not-allowed bg-slate-50",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          a.to ? "bg-brand-50 text-brand-600" : "bg-slate-200 text-slate-400",
        )}
      >
        <a.icon className="h-5 w-5" />
      </span>
      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
        {a.label}
        {a.soon && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">Soon</span>}
      </span>
    </div>
  );

  return a.to ? (
    <Link to={a.to}>{body}</Link>
  ) : (
    <div title="Coming soon">{body}</div>
  );
}

export function QuickActions() {
  return (
    <Card className="p-6">
      <h2 className="font-semibold text-slate-900">Quick actions</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {ACTIONS.map((a) => (
          <Tile key={a.label} a={a} />
        ))}
      </div>
    </Card>
  );
}
