import { Plus, Users } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";

export default function SellerHiring() {
  return (
    <div>
      <PageHeader
        title="Hire designers"
        subtitle="Post a brief, take bids from designers, pick the one you like."
        actions={
          <Button>
            <Plus className="h-4 w-4" /> Post a job call
          </Button>
        }
      />
      <Card className="p-6">
        <EmptyState
          icon={Users}
          title="No job calls yet"
          hint="Post a call with your budget and payment type — designers submit price bids, you chat and accept one."
          action={
            <Button size="sm">
              <Plus className="h-4 w-4" /> Post your first call
            </Button>
          }
        />
      </Card>
    </div>
  );
}
