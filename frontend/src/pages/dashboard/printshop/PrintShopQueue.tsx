import { Factory, Inbox, Package, Truck } from "lucide-react";

import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Stat } from "../../../components/ui/Stat";

export default function PrintShopQueue() {
  return (
    <div>
      <PageHeader title="Production queue" subtitle="Paid orders to make, then hand to shipment." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Inbox} label="To produce" value="0" hint="paid, waiting" />
        <Stat icon={Factory} label="In production" value="0" />
        <Stat icon={Truck} label="Handed to shipment" value="0" />
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <span>Product</span>
          <span>Variant</span>
          <span>Qty</span>
          <span>Status</span>
        </div>
        <div className="p-6">
          <EmptyState
            icon={Package}
            title="Queue is empty"
            hint="When a buyer's order is paid, the items you fulfil land here to move paid → in production → handed to shipment."
          />
        </div>
      </Card>
    </div>
  );
}
