import { Palette } from "lucide-react";

import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";

export default function DesignerCalls() {
  return (
    <div>
      <PageHeader title="Job calls" subtitle="Browse open briefs from sellers and submit your price bids." />
      <Card className="p-6">
        <EmptyState
          icon={Palette}
          title="No open calls right now"
          hint="When sellers post job calls, they'll appear here — open one to place a bid with your price and a message."
        />
      </Card>
    </div>
  );
}
