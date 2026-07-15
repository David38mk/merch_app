import { useCallback, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import { AuthCard, AuthDivider } from "../components/auth/AuthCard";
import { GoogleButton } from "../components/auth/GoogleButton";
import { PasswordChecklist } from "../components/auth/PasswordChecklist";
import { Button } from "../components/ui/Button";
import { apiError } from "../lib/apiError";
import { isPasswordValid } from "../lib/password";

export default function Signup() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmMismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    firstName.trim() && lastName.trim() && email && isPasswordValid(password) && confirm === password;

  async function afterAuth(verifyRequired: boolean) {
    navigate(verifyRequired ? "/verify-email?sent=1" : "/onboarding");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError(confirmMismatch ? "Passwords don't match." : "Please complete all fields.");
      return;
    }
    setBusy(true);
    try {
      const { verifyRequired } = await register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email,
        password,
      });
      await afterAuth(verifyRequired);
    } catch (err) {
      setError(apiError(err, "Could not create your account."));
    } finally {
      setBusy(false);
    }
  }

  const onGoogle = useCallback(
    async (credential: string) => {
      setError(null);
      try {
        await loginWithGoogle(credential, true);
        navigate("/onboarding");
      } catch (err) {
        setError(apiError(err, "Google sign-in failed."));
      }
    },
    [loginWithGoogle, navigate],
  );

  return (
    <AuthCard
      title="Create your seller account"
      subtitle="Start your storefront in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <GoogleButton text="signup_with" onCredential={onGoogle} />
      <AuthDivider />

      <form onSubmit={onSubmit} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First name</label>
            <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Last name</label>
            <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
        </div>
        <div className="mt-4">
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="mt-4">
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <PasswordChecklist pw={password} />
        </div>
        <div className="mt-4">
          <label className="label">Confirm password</label>
          <input
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {confirmMismatch && <p className="mt-1 text-xs text-red-600">Passwords don't match.</p>}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={busy || !canSubmit}>
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
