import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationSeen,
  type NotificationItem,
} from "../../api/notifications";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { cn } from "../../lib/cn";
import { NOTIFICATION_GROUPS, notificationMeta } from "../../lib/notificationMeta";
import { timeAgo } from "../../lib/timeAgo";

/** "Grouped by date" — the buckets a person actually thinks in. */
function dateBucket(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.floor((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  if (diffDays < 30) return "This month";
  return "Earlier";
}

const BUCKET_ORDER = ["Today", "Yesterday", "This week", "This month", "Earlier"];

export default function Notifications() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [group, setGroup] = useState<(typeof NOTIFICATION_GROUPS)[number]>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["notifications-page"],
    queryFn: () => getNotifications(100),
    refetchInterval: 45_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["notifications-page"] });
    qc.invalidateQueries({ queryKey: ["notifications"] }); // the bell dropdown
  };
  const seen = useMutation({ mutationFn: markNotificationSeen, onSuccess: refresh });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh });
  const remove = useMutation({ mutationFn: deleteNotification, onSuccess: refresh });

  const items = useMemo(() => {
    const all = data?.items ?? [];
    return group === "All" ? all : all.filter((n) => notificationMeta(n.type).group === group);
  }, [data, group]);

  const buckets = useMemo(() => {
    const by: Record<string, NotificationItem[]> = {};
    for (const n of items) (by[dateBucket(n.created_at)] ??= []).push(n);
    return BUCKET_ORDER.filter((b) => by[b]?.length).map((b) => [b, by[b]] as const);
  }, [items]);

  function open(n: NotificationItem) {
    if (!n.seen) seen.mutate(n.id);
    if (n.link_url) navigate(n.link_url);
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Everything that happened across your store, in one place."
        actions={
          (data?.unread ?? 0) > 0 ? (
            <Button variant="outline" size="sm" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
              <CheckCheck className="h-4 w-4" /> Mark all as read
            </Button>
          ) : undefined
        }
      />

      {/* Category filter */}
      <div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 sm:inline-flex">
        {NOTIFICATION_GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              group === g ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {g}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : buckets.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={Bell}
            title={group === "All" ? "No notifications yet" : `No ${group.toLowerCase()} notifications`}
            hint="Sales, order updates, applications and collaboration activity all land here."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {buckets.map(([bucket, list]) => (
            <div key={bucket}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {bucket}
              </h2>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-slate-50">
                  {list.map((n) => {
                    const meta = notificationMeta(n.type);
                    return (
                      <li key={n.id} className="group flex items-start gap-3 px-4 py-3.5 transition hover:bg-slate-50">
                        <button onClick={() => open(n)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            <meta.icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className={cn("truncate text-sm text-slate-800", !n.seen && "font-semibold")}>
                                {n.title}
                              </span>
                              {!n.seen && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />}
                            </span>
                            <span className="mt-0.5 block text-sm text-slate-500">{n.body}</span>
                            <span className="mt-1 block text-xs text-slate-400">{timeAgo(n.created_at)}</span>
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                          {!n.seen && (
                            <button
                              title="Mark as read"
                              onClick={() => seen.mutate(n.id)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <CheckCheck className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            title="Delete"
                            onClick={() => remove.mutate(n.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
