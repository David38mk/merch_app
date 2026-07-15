"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

const PLANS = [
  {
    id: "FREE",
    name: "Starter",
    price: "Free",
    commission: "15% commission",
    features: ["1 storefront", "Up to 5 products", "Basic analytics", "Community access"],
  },
  {
    id: "CREATOR",
    name: "Creator",
    price: "€19/month",
    commission: "10% commission",
    features: ["Unlimited products", "Discount codes", "Advanced analytics", "Affiliate links", "Priority print queue"],
    popular: true,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<"plan" | "profile">("plan");
  const [selectedPlan, setSelectedPlan] = useState("FREE");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSlugChange(val: string) {
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, bio, plan: selectedPlan }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  if (step === "plan") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-white p-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold mb-2">Choose your plan</h1>
            <p className="text-muted-foreground">You can always upgrade later.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`rounded-xl border p-6 cursor-pointer transition-all ${
                  selectedPlan === plan.id
                    ? "border-violet-600 bg-violet-50 ring-2 ring-violet-600"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{plan.name}</h3>
                      {plan.popular && <Badge>Popular</Badge>}
                    </div>
                    <p className="text-2xl font-bold mt-1">{plan.price}</p>
                    <p className="text-sm text-muted-foreground">{plan.commission}</p>
                  </div>
                  {selectedPlan === plan.id && (
                    <div className="rounded-full bg-violet-600 p-1">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-violet-600 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Button size="lg" onClick={() => setStep("profile")}>
              Continue with {PLANS.find((p) => p.id === selectedPlan)?.name}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-white p-6 flex items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Set up your storefront</CardTitle>
          <CardDescription>This is how buyers will find and recognise you.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Store name</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome Store"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Store URL</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  myhappinessclub.com/store/
                </span>
                <Input
                  id="slug"
                  required
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="my-store"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio (optional)</Label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell buyers a little about yourself..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep("plan")}>
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Setting up..." : "Launch storefront"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
