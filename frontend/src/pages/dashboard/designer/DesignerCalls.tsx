import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Loader2, Palette } from "lucide-react";
import { Link } from "react-router-dom";

import { listMarketplace } from "../../../api/hiring";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { payLabel } from "../seller/SellerHiring";

export default function DesignerCalls() {
  const { data, isLoading } = useQuery({ queryKey: ["marketplace"], queryFn: listMarketplace });

  return (
    <div>
      <PageHeader title="Job calls" subtitle="Browse open briefs from sellers and submit your price bids." />

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !data?.length ? (
        <Card className="p-6">
          <EmptyState
            icon={Palette}
            title="No open calls right now"
            hint="When sellers publish job calls, they'll appear here — open one to see the full brief."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Link key={c.id} to={`/designer/calls/${c.id}`}>
              <Card className="group flex h-full flex-col overflow-hidden transition hover:shadow-pop">
                <div className="aspect-video bg-slate-100">
                  {c.base_image_url && <img src={c.base_image_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="truncate font-medium text-slate-900">{c.title}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {c.seller_brand ?? "A seller"} · {c.base_name}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-500">{c.brief}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{payLabel(c)}</Badge>
                    {c.design_style && <Badge tone="slate">{c.design_style}</Badge>}
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-3 text-xs text-slate-400">
                    {c.deadline ? (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" /> {new Date(c.deadline).toLocaleDateString()}
                      </span>
                    ) : (
                      <span>No deadline</span>
                    )}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
