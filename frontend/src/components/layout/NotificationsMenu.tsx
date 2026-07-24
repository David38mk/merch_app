import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationSeen,
  type NotificationItem,
} from "../../api/notifications";
import { useClickOutside } from "../../hooks/useClickOutside";
import { cn } from "../../lib/cn";
import { notificationMeta } from "../../lib/notificationMeta";
import { timeAgo } from "../../lib/timeAgo";

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(false), open);

  // Polled so it's near-real-time without websockets (the deferred seam).
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(20),
    refetchInterval: 45_000,
  });

  const seenMut = useMutation({
    mutationFn: markNotificationSeen,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAllMut = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  function onItem(n: NotificationItem) {
    if (!n.seen) seenMut.mutate(n.id);
    if (n.link_url) {
      setOpen(false);
      navigate(n.link_url);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        title="Notifications"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {unread > 0 && (
              <button
                onClick={() => readAllMut.mutate()}
                className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
            className="block w-full border-b border-slate-100 px-4 py-2 text-center text-xs font-medium text-brand-600 hover:bg-slate-50"
          >
            View all notifications
          </button>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                <Bell className="mx-auto h-6 w-6 text-slate-300" />
                <p className="mt-2">No notifications yet</p>
              </div>
            ) : (
              items.map((n) => {
                const meta = notificationMeta(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={() => onItem(n)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50",
                      !n.seen && "bg-brand-50/40",
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
                      <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{n.body}</span>
                      <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(n.created_at)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
