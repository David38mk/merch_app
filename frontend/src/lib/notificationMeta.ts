import {
  Bell,
  CircleDollarSign,
  Megaphone,
  MessagesSquare,
  Package,
  Palette,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";

import type { NotificationType } from "../api/notifications";
import type { Tone } from "../components/ui/Badge";

interface Meta {
  icon: LucideIcon;
  tone: Tone;
  /** Filter-group label on the notifications page. */
  group: string;
}

const META: Record<NotificationType, Meta> = {
  SALE: { icon: CircleDollarSign, tone: "green", group: "Sales" },
  ORDER: { icon: ShoppingBag, tone: "brand", group: "Orders" },
  PAYMENT: { icon: RotateCcw, tone: "amber", group: "Payments" },
  NEW_BID: { icon: Palette, tone: "brand", group: "Applications" },
  BID_ACCEPTED: { icon: MessagesSquare, tone: "brand", group: "Collaborations" },
  COLLAB_UPDATE: { icon: MessagesSquare, tone: "brand", group: "Collaborations" },
  NEW_PRODUCTION_ORDER: { icon: Package, tone: "amber", group: "Orders" },
  ANNOUNCEMENT: { icon: Megaphone, tone: "slate", group: "Announcements" },
  REVIEW: { icon: Star, tone: "amber", group: "Reviews" },
  SYSTEM: { icon: Sparkles, tone: "slate", group: "System" },
};

export function notificationMeta(type: NotificationType): Meta {
  return META[type] ?? { icon: Bell, tone: "slate", group: "System" };
}

export const NOTIFICATION_GROUPS = [
  "All",
  "Sales",
  "Orders",
  "Payments",
  "Applications",
  "Collaborations",
  "Announcements",
  "System",
] as const;
