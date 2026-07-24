import {
  Frame,
  Gift,
  type LucideIcon,
  Palette,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sticker,
} from "lucide-react";

/** Icon for a product category by name — falls back to a generic gift icon so a
 * category a print shop adds later still renders sensibly. */
const ICONS: Record<string, LucideIcon> = {
  "t-shirts": Shirt,
  hoodies: Shirt,
  caps: ShoppingBag,
  "tote bags": ShoppingBag,
  mugs: Gift,
  "phone cases": Smartphone,
  posters: Frame,
  stickers: Sticker,
  art: Palette,
};

export function categoryIcon(name: string): LucideIcon {
  return ICONS[name.trim().toLowerCase()] ?? Gift;
}
