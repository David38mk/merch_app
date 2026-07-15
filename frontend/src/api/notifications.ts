import { api } from "./client";

export type NotificationType =
  | "SALE"
  | "NEW_BID"
  | "BID_ACCEPTED"
  | "COLLAB_UPDATE"
  | "NEW_PRODUCTION_ORDER"
  | "SYSTEM";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link_url: string | null;
  seen: boolean;
  created_at: string;
}

export interface NotificationList {
  unread: number;
  items: NotificationItem[];
}

export async function getNotifications(limit = 20): Promise<NotificationList> {
  return (await api.get<NotificationList>(`/notifications?limit=${limit}`)).data;
}

export async function markNotificationSeen(id: string): Promise<NotificationItem> {
  return (await api.post<NotificationItem>(`/notifications/${id}/seen`)).data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/notifications/read-all");
}
