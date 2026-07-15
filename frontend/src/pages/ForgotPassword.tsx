import { MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { forgotPassword } from "../api/auth";
import { AuthCard } from "../components/auth/AuthCard";
import { Button } from "../components/ui/Button";
import { apiError } from "../lib/apiError";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await forgotPassword(email);
      setDevUrl(res.dev_reset_url);
      setSent(true);
    } catch (err) {
      setError(apiError(err, "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle={sent ? undefined : "Enter your email and we'll send you a reset link."}
      footer={
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          ← Back to log in
        </Link>
      }
    >
      {sent ? (
        <div>
          <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p>If an account exists for that email, a reset link is on its way.</p>
          </div>
          {devUrl && (
            <div className="mt-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-sm">
              <p className="font-medium text-amber-800">Dev mode — email is stubbed</p>
              <a href={devUrl} className="mt-1 inline-block break-all font-medium text-brand-700 hover:underline">
                Open your reset link →
              </a>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <Button type="submit" className="mt-6 w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
