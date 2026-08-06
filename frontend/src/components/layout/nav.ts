import {
  Boxes,
  ChartLine,
  LayoutGrid,
  LucideIcon,
  MessagesSquare,
  Images,
  Package,
  Palette,
  Shirt,
  ShoppingBag,
  Store,
  UserRound,
  Users,
  Wand2,
} from "lucide-react";

import type { Role } from "../../api/auth";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavGroup {
  role: Role;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    role: "SELLER",
    label: "Seller",
    items: [
      { to: "/seller", label: "Studio", icon: Wand2, end: true },
      { to: "/seller/catalog", label: "Catalog", icon: LayoutGrid },
      { to: "/seller/storefront", label: "Storefront", icon: Store },
      { to: "/seller/products", label: "Products", icon: Shirt },
      { to: "/seller/orders", label: "Orders", icon: ShoppingBag },
      { to: "/seller/analytics", label: "Analytics", icon: ChartLine },
      { to: "/seller/hiring", label: "Job offers", icon: Users },
    ],
  },
  {
    role: "DESIGNER",
    label: "Designer",
    items: [
      { to: "/designer", label: "Job calls", icon: Palette, end: true },
      { to: "/designer/portfolio", label: "Portfolio", icon: Images },
      { to: "/designer/collabs", label: "Collaborations", icon: MessagesSquare },
      { to: "/designer/onboarding", label: "My profile", icon: UserRound },
    ],
  },
  {
    role: "PRINTSHOP",
    label: "Print shop",
    items: [
      { to: "/printshop", label: "Production queue", icon: Package, end: true },
      { to: "/printshop/catalog", label: "Catalog", icon: Boxes },
    ],
  },
  {
    role: "BUYER",
    label: "Buyer",
    items: [{ to: "/orders", label: "My orders", icon: ShoppingBag }],
  },
];
