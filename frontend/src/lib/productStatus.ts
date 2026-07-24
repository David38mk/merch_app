import type { Tone } from "../components/ui/Badge";
import type { ShopItemState } from "../api/shopItems";

/** One vocabulary for product state across the products page, cards and the
 * edit screen — the DB words (LISTED/UNLISTED) are never shown to sellers. */
export const PRODUCT_STATUS: Record<ShopItemState, { label: string; tone: Tone }> = {
  UNLISTED: { label: "Draft", tone: "slate" },
  LISTED: { label: "Published", tone: "green" },
  ARCHIVED: { label: "Archived", tone: "amber" },
  PENDING: { label: "In collaboration", tone: "brand" },
};
