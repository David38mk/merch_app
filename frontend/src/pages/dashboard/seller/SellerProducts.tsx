import { Package2, Wand2 } from "lucide-react";
import { useState } from "react";

import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { cn } from "../../../lib/cn";

const TABS = ["Listed", "Unlisted", "Pending"] as const;

export default function SellerProducts() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Listed");

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Everything you've designed — listed, unlisted, or in a collaboration."
        actions={
          <Button>
            <Wand2 className="h-4 w-4" /> New product
          </Button>
        }
      />

      <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-sm font-medium transition",
              tab === t ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <Card className="p-6">
        <EmptyState
          icon={Package2}
          title={`No ${tab.toLowerCase()} products`}
          hint="This is where the 'Design now' flow (upload / AI + placement) will drop finished products."
        />
      </Card>
    </div>
  );
}
