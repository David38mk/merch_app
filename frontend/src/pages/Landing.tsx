import { useQuery } from "@tanstack/react-query";
import { Package, Truck, Users, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";

import { listBaseItems } from "../api/catalog";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";

const features = [
  { icon: Wand2, title: "Design with AI", body: "Generate artwork or upload your own, then drop it onto any blank." },
  { icon: Users, title: "Hire designers", body: "Post a brief, take bids from designers, collaborate in-app." },
  { icon: Truck, title: "We print & ship", body: "Print shops fulfil your orders — you just share your store." },
];

export default function Landing() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["base-items"], queryFn: listBaseItems });

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50/70 to-slate-50">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center sm:py-28">
          <Badge>Creator print-on-demand</Badge>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Turn your audience into a brand.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-500">
            Design merch with AI or hire a designer. Print shops handle production and shipping — you keep the
            spotlight.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/signup">
              <Button>Start selling</Button>
            </Link>
            <a href="#catalog">
              <Button variant="outline">Browse blanks</Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-5 sm:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Live catalog */}
      <section id="catalog" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Blank catalog</h2>
            <p className="text-sm text-slate-500">Live from the API — the blanks creators design on.</p>
          </div>
        </div>

        {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {isError && (
          <Card className="p-6">
            <p className="text-sm text-red-600">Could not reach the API — is the backend running on :8001?</p>
          </Card>
        )}
        {data && data.length === 0 && (
          <EmptyState
            icon={Package}
            title="No blanks yet"
            hint="Sign up as a print shop and add BaseItems — they'll show up here."
            action={
              <Link to="/signup">
                <Button size="sm">Become a print shop</Button>
              </Link>
            }
          />
        )}
        {data && data.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((b) => (
              <Card key={b.id} className="overflow-hidden">
                <div className="flex h-40 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
                  <Package className="h-8 w-8" />
                </div>
                <div className="p-4">
                  <p className="font-medium text-slate-900">{b.name}</p>
                  {b.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{b.description}</p>}
                  <p className="mt-2 text-sm font-semibold text-brand-700">from €{String(b.base_price)}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
