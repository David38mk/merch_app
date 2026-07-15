import { MessagesSquare } from "lucide-react";

import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";

export default function DesignerCollabs() {
  return (
    <div>
      <PageHeader title="Collaborations" subtitle="Active projects with sellers — submit work, get feedback, chat." />
      <Card className="p-6">
        <EmptyState
          icon={MessagesSquare}
          title="No collaborations yet"
          hint="Once a seller accepts your bid, the project opens here and walks the preview → final → payment steps."
        />
      </Card>
    </div>
  );
}
