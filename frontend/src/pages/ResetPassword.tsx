import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { resetPassword } from "../api/auth";
import { AuthCard } from "../components/auth/AuthCard";
import { PasswordChecklist } from "../components/auth/PasswordChecklist";
import { Button } from "../components/ui/Button";
import { apiError } from "../lib/apiError";
import { isPasswordValid } from "../lib/password";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = isPasswordValid(password) && confirm === password;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(apiError(err, "This reset link is invalid or has expired."));
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthCard
        title="Invalid reset link"
        subtitle="This link is missing its token. Request a new one."
        footer={
          <Link to="/forgot-password" className="font-medium text-brand-700 hover:underline">
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-slate-500">The link you followed doesn't contain a valid reset token.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      footer={
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Back to log in
        </Link>
      }
    >
      {done ? (
        <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-medium">Password updated.</p>
          <Link to="/login" className="mt-2 inline-block font-medium text-brand-700 hover:underline">
            Log in with your new password →
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <label className="label">New password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <PasswordChecklist pw={password} />
          <div className="mt-4">
            <label className="label">Confirm password</label>
            <input
              className="input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            {confirm.length > 0 && confirm !== password && (
              <p className="mt-1 text-xs text-red-600">Passwords don't match.</p>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <Button type="submit" className="mt-6 w-full" disabled={busy || !canSubmit}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
