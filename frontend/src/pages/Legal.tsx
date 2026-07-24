import { Link } from "react-router-dom";

import { Brand } from "../components/layout/Brand";

/** Placeholder Terms / Privacy pages so the signup consent links resolve.
 * Real legal copy is a content task, not an engineering one — these stand in. */
export function Terms() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        This is a preview build of MyHappinessClub. By creating an account you agree to use the
        platform lawfully and accept that features are still in active development.
      </p>
      <p>Full terms will be published before general availability.</p>
    </LegalShell>
  );
}

export function Privacy() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        We store the information you provide (name, email, orders) to run your account and process
        purchases. We don't sell your data. Visitor analytics are collected without cookies, using a
        salted hash of your IP that can't be reversed to identify you.
      </p>
      <p>A complete privacy policy will accompany the public launch.</p>
    </LegalShell>
  );
}

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6">
          <Link to="/">
            <Brand />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-600">{children}</div>
        <Link to="/" className="mt-8 inline-block text-sm font-medium text-brand-700 hover:underline">
          ← Back to MyHappinessClub
        </Link>
      </main>
    </div>
  );
}
