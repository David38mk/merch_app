import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getNotifications } from "../../api/notifications";
import { cn } from "../../lib/cn";
import { notificationMeta } from "../../lib/notificationMeta";
import { timeAgo } from "../../lib/timeAgo";
import { Card } from "../ui/Card";

export function RecentNotifications() {
  const navigate = useNavigate();
  // Same query key as the bell → one shared, polled fetch.
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(20),
    refetchInterval: 45_000,
  });

  const items = (data?.items ?? []).slice(0, 4);

  return (
    <Card className="p-6">
      <h2 className="font-semibold text-slate-900">Recent activity</h2>

      {items.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-8 text-center">
          <Bell className="h-6 w-6 text-slate-300" />
          <p className="mt-2 text-sm text-slate-400">No notifications yet</p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-50">
          {items.map((n) => {
            const meta = notificationMeta(n.type);
            const clickable = Boolean(n.link_url);
            return (
              <li key={n.id}>
                <button
                  disabled={!clickable}
                  onClick={() => n.link_url && navigate(n.link_url)}
                  className={cn(
                    "flex w-full items-start gap-3 py-3 text-left",
                    clickable && "transition hover:opacity-70",
                  )}
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <meta.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-800">{n.title}</span>
                      {!n.seen && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />}
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-xs text-slate-500">{n.body}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(n.created_at)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
