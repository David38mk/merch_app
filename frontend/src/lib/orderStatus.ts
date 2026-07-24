import type { OrderDisplayStatus } from "../api/orders";
import type { Tone } from "../components/ui/Badge";

/** One vocabulary for the 7 order statuses across list, detail and queue. */
export const ORDER_STATUS: Record<OrderDisplayStatus, { label: string; tone: Tone }> = {
  PENDING_PAYMENT: { label: "Pending payment", tone: "slate" },
  PAID: { label: "Paid", tone: "brand" },
  IN_PRODUCTION: { label: "In production", tone: "amber" },
  SHIPPED: { label: "Shipped", tone: "brand" },
  DELIVERED: { label: "Delivered", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "slate" },
  REFUNDED: { label: "Refunded", tone: "amber" },
};

export const ORDER_EVENT_LABELS: Record<string, string> = {
  PLACED: "Order received",
  PAID: "Payment confirmed",
  SENT_TO_PROVIDER: "Sent to print provider",
  IN_PRODUCTION: "Production started",
  QUALITY_CHECK: "Quality check",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

/** The expected fulfillment path, in order — the stepper on the order detail.
 * Cancelled/refunded orders fall back to the raw event log instead. */
export const ORDER_STEPS = [
  "PLACED",
  "PAID",
  "SENT_TO_PROVIDER",
  "IN_PRODUCTION",
  "QUALITY_CHECK",
  "SHIPPED",
  "DELIVERED",
] as const;
