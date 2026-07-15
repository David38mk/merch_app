import { ArrowRight, Package, Palette, ShoppingBag, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type { Role } from "../../api/auth";
import { useAuth } from "../../auth";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import SellerHome from "./SellerHome";

const ROLE_CARDS: Record<Role, { icon: LucideIcon; title: string; body: string; to: string }> = {
  SELLER: { icon: Store, title: "Seller studio", body: "Create products, design, and hire designers.", to: "/seller" },
  DESIGNER: { icon: Palette, title: "Designer", body: "Browse job calls and submit your bids.", to: "/designer" },
  PRINTSHOP: { icon: Package, title: "Print shop", body: "Manage your catalog and production queue.", to: "/printshop" },
  BUYER: { icon: ShoppingBag, title: "Buyer", body: "Track the orders you've placed.", to: "/orders" },
};

export default function Overview() {
  const { user } = useAuth();
  if (!user) return null;

  // Sellers get the full business dashboard. (Every account is a seller by default,
  // so this is the common path; pure buyers/other roles get the workspace grid.)
  if (user.roles.includes("SELLER")) return <SellerHome />;

  const cards = user.roles.map((r) => ROLE_CARDS[r]).filter(Boolean);

  return (
    <div>
      <PageHeader title={`Welcome, ${user.display_name.split(" ")[0]}`} subtitle="Here's your workspace." />
      <div className="grid gap-5 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.to} to={c.to}>
            <Card className="group flex items-center gap-4 p-5 transition hover:shadow-pop">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <c.icon className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{c.title}</p>
                <p className="text-sm text-slate-500">{c.body}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
