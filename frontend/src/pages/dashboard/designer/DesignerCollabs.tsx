import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Loader2, MessagesSquare } from "lucide-react";
import { Link } from "react-router-dom";

import { listCollaborations } from "../../../api/collaborations";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { stageMeta } from "../../../lib/collabStage";

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

export default function DesignerCollabs() {
  const { data, isLoading } = useQuery({ queryKey: ["collabs"], queryFn: listCollaborations });

  return (
    <div>
      <PageHeader title="Collaborations" subtitle="Active projects with sellers — submit work, get feedback, chat." />

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !data?.length ? (
        <Card className="p-6">
          <EmptyState
            icon={MessagesSquare}
            title="No collaborations yet"
            hint="Once a seller accepts your bid, the project opens here and walks the draft → final → payment steps."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((c) => {
            const meta = stageMeta(c.stage);
            return (
              <Link key={c.id} to={`/collaborations/${c.id}`}>
                <Card className="flex flex-wrap items-center gap-4 p-4 transition hover:shadow-pop">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {c.base_image_url && <img src={c.base_image_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-slate-900">{c.title}</p>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      with {c.counterpart} · you're the {c.my_role}
                    </p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400">
                      <CalendarDays className="h-3 w-3" /> {date(c.deadline)}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-300" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
