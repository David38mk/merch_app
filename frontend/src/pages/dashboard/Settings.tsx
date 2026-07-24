import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Check,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  Store,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  changeEmail,
  changePassword,
  getAccount,
  logoutEverywhere,
  removeAvatar,
  updateBusiness,
  updatePreferences,
  updateProfile,
  uploadAvatar,
  type Account,
} from "../../api/account";
import { useAuth } from "../../auth";
import { AddressBook } from "../../components/account/AddressBook";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiError } from "../../lib/apiError";
import { timeAgo } from "../../lib/timeAgo";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hr", label: "Hrvatski" },
  { code: "de", label: "Deutsch" },
];

const TIMEZONES = [
  "Europe/Zagreb", "Europe/Berlin", "Europe/London", "Europe/Paris", "Europe/Madrid",
  "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney", "UTC",
];

const CURRENCIES = ["EUR", "USD", "GBP", "HRK", "CHF", "JPY", "AUD", "CAD"];

export default function Settings() {
  const qc = useQueryClient();
  const { user, refreshUser } = useAuth();
  const isSeller = user?.roles.includes("SELLER") ?? false;
  const { data: acc, isLoading } = useQuery({ queryKey: ["account"], queryFn: getAccount });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!acc || hydrated.current) return;
    hydrated.current = true;
    setFirstName(acc.personal.first_name);
    setLastName(acc.personal.last_name);
    setPhone(acc.personal.phone ?? "");
    setTaxId(acc.business.tax_id ?? "");
    setCountry(acc.business.country ?? "");
    setCurrency(acc.business.currency ?? "");
  }, [acc]);

  const adopt = (label: string) => (a: Account) => {
    qc.setQueryData(["account"], a);
    setError(null);
    setSaved(label);
    setTimeout(() => setSaved(null), 2000);
    void refreshUser();
  };
  const onError = (e: unknown) => setError(apiError(e, "Couldn't save that."));

  const profile = useMutation({ mutationFn: updateProfile, onSuccess: adopt("Profile saved"), onError });
  const business = useMutation({ mutationFn: updateBusiness, onSuccess: adopt("Business info saved"), onError });
  const prefs = useMutation({ mutationFn: updatePreferences, onSuccess: adopt("Preferences saved"), onError });
  const avatarUp = useMutation({ mutationFn: uploadAvatar, onSuccess: adopt("Photo updated"), onError });
  const avatarDel = useMutation({ mutationFn: removeAvatar, onSuccess: adopt("Photo removed"), onError });

  if (isLoading || !acc) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="My account"
        subtitle={
          isSeller
            ? "Your account, business information, preferences and security."
            : "Your profile, addresses, preferences and security."
        }
        actions={saved ? <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600"><Check className="h-4 w-4" /> {saved}</span> : undefined}
      />
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="space-y-6">
        {/* ── Personal ─────────────────────────────────────────── */}
        <Card className="p-6">
          <SectionTitle icon={UserRound} title="Personal information" />
          <div className="mt-4 flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
              {acc.personal.avatar_url ? (
                <img src={acc.personal.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (acc.personal.display_name[0] ?? "?").toUpperCase()
              )}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => avatarRef.current?.click()} disabled={avatarUp.isPending}>
                <Upload className="h-4 w-4" /> {acc.personal.avatar_url ? "Replace photo" : "Upload photo"}
              </Button>
              {acc.personal.avatar_url && (
                <Button variant="ghost" size="sm" onClick={() => avatarDel.mutate()}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <input
                ref={avatarRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && avatarUp.mutate(e.target.files[0])}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">First name</label>
              <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="label">Last name</label>
              <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <label className="label">Email</label>
              <p className="truncate text-sm text-slate-700">
                {acc.personal.email}{" "}
                {acc.personal.email_verified ? (
                  <Badge tone="green">Verified</Badge>
                ) : (
                  <Badge tone="amber">Unverified</Badge>
                )}
              </p>
            </div>
            <ChangeEmailButton disabled={acc.security.connected_google} onDone={adopt("Email changed — check your inbox to verify")} onError={onError} />
          </div>
          <div className="mt-4">
            <label className="label">Phone <span className="font-normal text-slate-400">(optional)</span></label>
            <input className="input sm:max-w-xs" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+385 91 234 5678" />
          </div>
          <div className="mt-4 text-right">
            <Button
              size="sm"
              onClick={() => profile.mutate({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() })}
              disabled={profile.isPending || !firstName.trim() || !lastName.trim()}
            >
              Save personal info
            </Button>
          </div>
        </Card>

        {/* ── Saved addresses (buyers + sellers) ───────────────── */}
        <AddressBook />

        {/* ── Business (sellers only) ──────────────────────────── */}
        {isSeller && (
        <Card className="p-6">
          <SectionTitle icon={Building2} title="Business information" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Business / brand name</label>
              <input className="input bg-slate-50 text-slate-500" value={acc.business.brand_name ?? ""} disabled />
              <p className="mt-1 text-xs text-slate-400">
                Edited in the <Link to="/seller/storefront" className="text-brand-600 hover:underline">website builder</Link> — it's part of your published storefront.
              </p>
            </div>
            <div>
              <label className="label">VAT / Tax ID <span className="font-normal text-slate-400">(optional)</span></label>
              <input className="input" value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="HR12345678901" />
            </div>
            <div>
              <label className="label">Country</label>
              <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div>
              <label className="label">Currency</label>
              <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="EUR" maxLength={3} />
            </div>
          </div>
          <div className="mt-4 text-right">
            <Button size="sm" onClick={() => business.mutate({ tax_id: taxId, country, currency })} disabled={business.isPending}>
              Save business info
            </Button>
          </div>
        </Card>
        )}

        {/* ── Store (sellers only) ─────────────────────────────── */}
        {isSeller && (
        <Card className="p-6">
          <SectionTitle icon={Store} title="Store settings" />
          <p className="mt-3 text-sm text-slate-600">
            Store URL{" "}
            <span className="font-mono text-slate-800">/store/{acc.store.slug ?? "—"}</span>{" "}
            {acc.store.is_published ? <Badge tone="green">Live</Badge> : <Badge tone="slate">Not published</Badge>}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Store URL, social links and brand assets live in the website builder, where changes stay in
            draft until you publish them.
          </p>
          <Link to="/seller/storefront" className="mt-3 inline-block">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4" /> Open website builder
            </Button>
          </Link>
        </Card>
        )}

        {/* ── Preferences ──────────────────────────────────────── */}
        <Card className="p-6">
          <SectionTitle icon={Monitor} title="Preferences" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Language</label>
              <select
                className="input"
                value={acc.preferences.language}
                onChange={(e) => prefs.mutate({ language: e.target.value })}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Currency</label>
              <select
                className="input"
                value={acc.preferences.currency}
                onChange={(e) => prefs.mutate({ currency: e.target.value })}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Timezone</label>
              <select
                className="input"
                value={acc.preferences.timezone ?? ""}
                onChange={(e) => prefs.mutate({ timezone: e.target.value })}
              >
                <option value="">Browser default</option>
                {TIMEZONES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <Toggle
              label="Email notifications"
              hint="Sales, order updates and collaboration activity."
              checked={acc.preferences.email_notifications}
              onChange={(v) => prefs.mutate({ email_notifications: v })}
            />
            <Toggle
              label="Marketing emails"
              hint="Product news, tips and offers."
              checked={acc.preferences.marketing_emails}
              onChange={(v) => prefs.mutate({ marketing_emails: v })}
            />
          </div>
        </Card>

        {/* ── Security ─────────────────────────────────────────── */}
        <Card className="p-6">
          <SectionTitle icon={KeyRound} title="Security" />

          <ChangePasswordForm hasPassword={acc.security.has_password} onError={onError} onDone={() => adoptText()} />

          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-800">Connected accounts</h3>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <Mail className="h-4 w-4 text-slate-400" />
              Google —{" "}
              {acc.security.connected_google ? (
                <Badge tone="green">Connected</Badge>
              ) : (
                <span className="text-slate-400">not connected (sign-in with email &amp; password)</span>
              )}
            </p>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-800">Active sessions</h3>
            <p className="mt-2 text-sm text-slate-600">
              This device
              {acc.security.session_started && (
                <span className="text-slate-400"> · signed in {timeAgo(acc.security.session_started)}</span>
              )}{" "}
              <Badge tone="green">current</Badge>
            </p>
            <LogoutEverywhereButton onError={onError} />
            {acc.security.sessions_revoked_at && (
              <p className="mt-2 text-xs text-slate-400">
                All other sessions were last logged out {timeAgo(acc.security.sessions_revoked_at)}.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );

  function adoptText() {
    setError(null);
    setSaved("Password changed — other devices were logged out");
    setTimeout(() => setSaved(null), 3000);
  }
}

// ── pieces ────────────────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title }: { icon: typeof UserRound; title: string }) {
  return (
    <h2 className="flex items-center gap-2 font-semibold text-slate-900">
      <Icon className="h-4 w-4 text-slate-400" /> {title}
    </h2>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        <span className="block text-xs text-slate-400">{hint}</span>
      </span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand-600" : "bg-slate-200"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </label>
  );
}

function ChangePasswordForm({
  hasPassword,
  onDone,
  onError,
}: {
  hasPassword: boolean;
  onDone: () => void;
  onError: (e: unknown) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const mut = useMutation({
    mutationFn: () => changePassword(hasPassword ? current : null, next),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      onDone();
    },
    onError,
  });
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-slate-800">
        {hasPassword ? "Change password" : "Set a password"}
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {hasPassword && (
          <input
            type="password"
            className="input"
            placeholder="Current password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        )}
        <input
          type="password"
          className="input"
          placeholder="New password (8+ chars, letter + number)"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <p className="mt-1.5 text-xs text-slate-400">Changing it logs out every other device.</p>
      <Button
        size="sm"
        className="mt-3"
        onClick={() => mut.mutate()}
        disabled={mut.isPending || !next || (hasPassword && !current)}
      >
        {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Update password
      </Button>
    </div>
  );
}

function ChangeEmailButton({
  disabled,
  onDone,
  onError,
}: {
  disabled: boolean;
  onDone: (a: Account) => void;
  onError: (e: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const mut = useMutation({
    mutationFn: () => changeEmail(email.trim(), password),
    onSuccess: (a) => {
      setOpen(false);
      setEmail("");
      setPassword("");
      onDone(a);
    },
    onError,
  });

  if (disabled) {
    return <p className="text-xs text-slate-400">Managed by Google</p>;
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Change email
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-sm p-6">
            <h3 className="font-semibold text-slate-900">Change email</h3>
            <p className="mt-1 text-sm text-slate-500">
              Your password confirms the change; the new address gets a verification link.
            </p>
            <div className="mt-4 space-y-3">
              <input className="input" type="email" placeholder="New email address" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="input" type="password" placeholder="Current password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => mut.mutate()} disabled={mut.isPending || !email.trim() || !password}>
                {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Change email
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function LogoutEverywhereButton({ onError }: { onError: (e: unknown) => void }) {
  const qc = useQueryClient();
  const [done, setDone] = useState(false);
  const mut = useMutation({
    mutationFn: logoutEverywhere,
    onSuccess: () => {
      setDone(true);
      qc.invalidateQueries({ queryKey: ["account"] });
      setTimeout(() => setDone(false), 3000);
    },
    onError,
  });
  return (
    <Button variant="outline" size="sm" className="mt-3" onClick={() => mut.mutate()} disabled={mut.isPending}>
      {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      {done ? "Done — other devices logged out" : "Log out of all other devices"}
    </Button>
  );
}
