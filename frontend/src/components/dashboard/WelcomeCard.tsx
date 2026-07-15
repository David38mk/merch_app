import { PartyPopper, Sparkles } from "lucide-react";

export function WelcomeCard({
  firstName,
  stepsDone,
  stepsTotal,
  isActive,
}: {
  firstName: string;
  stepsDone: number;
  stepsTotal: number;
  isActive: boolean;
}) {
  const pct = stepsTotal ? Math.round((stepsDone / stepsTotal) * 100) : 0;

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 p-6 text-white shadow-card sm:p-7">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
          {isActive ? <Sparkles className="h-5 w-5" /> : <PartyPopper className="h-5 w-5" />}
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isActive ? `Welcome back, ${firstName}` : `Welcome, ${firstName}!`}
          </h1>
          <p className="mt-1 text-sm text-white/80">
            {isActive
              ? "Your store is live — here's your business at a glance."
              : "Let's finish setting up your store so you can start selling."}
          </p>
        </div>
      </div>

      {!isActive && (
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-white/90">
            <span>Setup progress</span>
            <span>
              {stepsDone} of {stepsTotal} done
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
