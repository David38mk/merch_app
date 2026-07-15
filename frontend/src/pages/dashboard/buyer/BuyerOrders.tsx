import { ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";

export default function BuyerOrders() {
  return (
    <div>
      <PageHeader title="My orders" subtitle="Everything you've bought across storefronts." />
      <Card className="p-6">
        <EmptyState
          icon={ShoppingBag}
          title="No orders yet"
          hint="Find something you like on a creator's storefront and check out."
          action={
            <Link to="/">
              <Button size="sm">Explore storefronts</Button>
            </Link>
          }
        />
      </Card>
    </div>
  );
}
