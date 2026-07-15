import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign, Loader2, Package2, ShoppingCart, Sparkles } from "lucide-react";

import { getSellerDashboard } from "../../api/dashboard";
import { OnboardingChecklist } from "../../components/dashboard/OnboardingChecklist";
import { QuickActions } from "../../components/dashboard/QuickActions";
import { RecentNotifications } from "../../components/dashboard/RecentNotifications";
import { WelcomeCard } from "../../components/dashboard/WelcomeCard";
import { Stat } from "../../components/ui/Stat";

export default function SellerHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["seller-dashboard"],
    queryFn: getSellerDashboard,
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const { stats } = data;

  return (
    <div className="space-y-6">
      <WelcomeCard
        firstName={data.first_name}
        stepsDone={data.steps_done}
        stepsTotal={data.steps_total}
        isActive={data.is_active}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {data.is_active ? (
            <div className="grid grid-cols-2 gap-4">
              <Stat icon={CircleDollarSign} label="Orders" value={String(stats.orders)} hint="all time" />
              <Stat icon={Package2} label="Live products" value={String(stats.live_products)} hint={`${stats.products} total`} />
              <Stat icon={ShoppingCart} label="Products" value={String(stats.products)} hint="in your studio" />
              <Stat icon={Sparkles} label="AI credits" value={String(stats.ai_credits)} hint="resets monthly" />
            </div>
          ) : (
            <OnboardingChecklist checklist={data.checklist} />
          )}
          <QuickActions />
        </div>

        <div className="space-y-6">
          <RecentNotifications />
        </div>
      </div>
    </div>
  );
}
