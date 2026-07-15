import {
  Bell,
  CircleDollarSign,
  MessagesSquare,
  Package,
  Palette,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { NotificationType } from "../api/notifications";
import type { Tone } from "../components/ui/Badge";

interface Meta {
  icon: LucideIcon;
  tone: Tone;
}

const META: Record<NotificationType, Meta> = {
  SALE: { icon: CircleDollarSign, tone: "green" },
  NEW_BID: { icon: Palette, tone: "brand" },
  BID_ACCEPTED: { icon: MessagesSquare, tone: "brand" },
  COLLAB_UPDATE: { icon: MessagesSquare, tone: "brand" },
  NEW_PRODUCTION_ORDER: { icon: Package, tone: "amber" },
  SYSTEM: { icon: Sparkles, tone: "slate" },
};

export function notificationMeta(type: NotificationType): Meta {
  return META[type] ?? { icon: Bell, tone: "slate" };
}
