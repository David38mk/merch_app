import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-50 to-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b bg-white/80 backdrop-blur">
        <span className="text-xl font-bold text-violet-700">MyHappinessClub</span>
        <div className="flex gap-3">
          <Button variant="ghost" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-6">
          Sell your merch.{" "}
          <span className="text-violet-600">Share your happiness.</span>
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          The creator-first merch platform. Build your storefront, list your products,
          and connect with a community of designers and buyers.
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg" asChild>
            <Link href="/signup">Start selling for free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/signup?role=buyer">Shop storefronts</Link>
          </Button>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            title: "Free to start",
            desc: "Open your storefront with no upfront cost. We only earn when you do — 15% commission on sales.",
          },
          {
            title: "Go pro for less",
            desc: "€19/month Creator plan drops commission to 10% and unlocks unlimited products and advanced analytics.",
          },
          {
            title: "Built for creators",
            desc: "Custom branding, discount codes, and designer collaboration tools built into every storefront.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-gray-600 text-sm">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
