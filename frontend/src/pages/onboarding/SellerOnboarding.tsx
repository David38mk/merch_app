import { ArrowLeft, ArrowRight, Check, Loader2, PartyPopper, Share2, Store, Wand2 } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  completeOnboarding,
  getOnboarding,
  saveOnboarding,
  type AccountType,
} from "../../api/onboarding";
import { useAuth } from "../../auth";
import { Brand } from "../../components/layout/Brand";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { apiError } from "../../lib/apiError";
import { cn } from "../../lib/cn";
import { COUNTRIES, CURRENCIES, currencyForCountry } from "../../lib/geo";

const STEPS = ["Welcome", "Brand", "Country & Currency", "Finish"];

export default function SellerOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [brandName, setBrandName] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("PERSONAL");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("");

  // Load existing progress; if already done, never show onboarding again.
  useEffect(() => {
    getOnboarding()
      .then((s) => {
        if (s.completed) {
          navigate("/dashboard", { replace: true });
          return;
        }
        setBrandName(s.brand_name ?? "");
        setCreatorName(s.creator_name ?? "");
        setAccountType(s.account_type ?? "PERSONAL");
        setCountry(s.country ?? "");
        setCurrency(s.currency ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [navigate]);

  const brandValid = brandName.trim().length > 0;
  const geoValid = Boolean(country && currency);

  function onCountry(code: string) {
    setCountry(code);
    const cur = currencyForCountry(code);
    if (cur) setCurrency(cur); // sensible default; user can still change it
  }

  async function goNext() {
    setError(null);
    setSaving(true);
    try {
      if (step === 1)
        await saveOnboarding({
          brand_name: brandName.trim(),
          creator_name: creatorName.trim() || undefined,
          account_type: accountType,
        });
      if (step === 2) await saveOnboarding({ country, currency });
      setStep((s) => s + 1);
    } catch (e) {
      setError(apiError(e, "Couldn't save — please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    setError(null);
    setSaving(true);
    try {
      await completeOnboarding({
        brand_name: brandName.trim(),
        creator_name: creatorName.trim() || undefined,
        country,
        currency,
        account_type: accountType,
      });
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(apiError(e, "Couldn't finish onboarding."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/60 to-slate-50">
      <div className="mx-auto flex max-w-xl flex-col px-6 py-10">
        <div className="flex justify-center">
          <Brand />
        </div>

        {/* Progress indicator */}
        <div className="mt-8 flex items-center">
          {STEPS.map((label, i) => (
            <Fragment key={label}>
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition",
                    i < step && "bg-brand-600 text-white",
                    i === step && "bg-brand-600 text-white ring-4 ring-brand-100",
                    i > step && "bg-white text-slate-400 ring-1 ring-slate-200",
                  )}
                >
                  {i < step ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("hidden text-xs sm:block", i <= step ? "text-slate-700" : "text-slate-400")}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("mx-1 h-0.5 flex-1 rounded", i < step ? "bg-brand-500" : "bg-slate-200")} />
              )}
            </Fragment>
          ))}
        </div>

        <Card className="mt-6 p-8">
          {step === 0 && (
            <div className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                <PartyPopper className="h-6 w-6" />
              </span>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
                Welcome, {user?.first_name || "there"}!
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-slate-500">
                Let's set up your brand. It takes under a minute and everything saves as you go.
              </p>
              <div className="mt-6 space-y-2 text-left">
                {[
                  { icon: Store, t: "Name your brand" },
                  { icon: Wand2, t: "Pick your country & currency" },
                  { icon: Share2, t: "Head to your dashboard" },
                ].map((r) => (
                  <div key={r.t} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <r.icon className="h-4 w-4 text-brand-600" /> {r.t}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-lg font-bold text-slate-900">Brand information</h2>
              <p className="mt-1 text-sm text-slate-500">This is how buyers will find your storefront.</p>
              <div className="mt-5">
                <label className="label">Brand name</label>
                <input
                  className="input"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Aurora Studio"
                  required
                />
              </div>
              <div className="mt-4">
                <label className="label">
                  Creator name <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  className="input"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="The name behind the brand"
                />
              </div>
              <div className="mt-4">
                <label className="label">
                  Account type <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["PERSONAL", "COMPANY"] as AccountType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAccountType(t)}
                      className={cn(
                        "rounded-lg border px-4 py-2.5 text-sm font-medium transition",
                        accountType === t
                          ? "border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-100"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                      )}
                    >
                      {t === "PERSONAL" ? "Personal" : "Company"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-lg font-bold text-slate-900">Country & currency</h2>
              <p className="mt-1 text-sm text-slate-500">We use these for payouts and pricing.</p>
              <div className="mt-5">
                <label className="label">Country</label>
                <select className="input" value={country} onChange={(e) => onCountry(e.target.value)} required>
                  <option value="" disabled>
                    Select a country…
                  </option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-4">
                <label className="label">Currency</label>
                <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} required>
                  <option value="" disabled>
                    Select a currency…
                  </option>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-lg font-bold text-slate-900">You're all set</h2>
              <p className="mt-1 text-sm text-slate-500">Review and finish — you can edit anything later.</p>
              <dl className="mt-5 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {[
                  ["Brand", brandName || "—"],
                  ["Creator", creatorName || "—"],
                  ["Country", COUNTRIES.find((c) => c.code === country)?.name || "—"],
                  ["Currency", currency || "—"],
                  ["Account type", accountType === "PERSONAL" ? "Personal" : "Company"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between px-4 py-2.5 text-sm">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-medium text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </Card>

        {/* Nav */}
        <div className="mt-5 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : (
            <span />
          )}

          {step < 3 ? (
            <Button onClick={goNext} disabled={saving || (step === 1 && !brandValid) || (step === 2 && !geoValid)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {step === 0 ? "Get started" : "Next"} <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Finish
            </Button>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-slate-400">Your answers save automatically.</p>
      </div>
    </div>
  );
}
