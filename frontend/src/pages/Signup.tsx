import { useCallback, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import { AuthCard, AuthDivider } from "../components/auth/AuthCard";
import { GoogleButton } from "../components/auth/GoogleButton";
import { PasswordChecklist } from "../components/auth/PasswordChecklist";
import { TermsCheckbox } from "../components/auth/TermsCheckbox";
import { Button } from "../components/ui/Button";
import { apiError } from "../lib/apiError";
import { isPasswordValid } from "../lib/password";
import { returnTo } from "../lib/returnTo";

export default function Signup() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Where to land after signing up: the page they came from, else the homepage.
  const dest = returnTo(location, "/");

  const confirmMismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    firstName.trim() && lastName.trim() && email && isPasswordValid(password) && confirm === password && terms;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      if (!terms) setError("Please accept the Terms and Privacy Policy.");
      else setError(confirmMismatch ? "Passwords don't match." : "Please complete all fields.");
      return;
    }
    setBusy(true);
    try {
      const { verifyRequired } = await register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email,
        password,
        intent: "buyer",
        accept_terms: terms,
      });
      navigate(verifyRequired ? "/verify-email?sent=1" : dest, { replace: true });
    } catch (err) {
      setError(apiError(err, "Could not create your account."));
    } finally {
      setBusy(false);
    }
  }

  const onGoogle = useCallback(
    async (credential: string) => {
      setError(null);
      if (!terms) {
        setError("Please accept the Terms and Privacy Policy first.");
        return;
      }
      try {
        await loginWithGoogle(credential, true, "buyer");
        navigate(dest, { replace: true });
      } catch (err) {
        setError(apiError(err, "Google sign-in failed."));
      }
    },
    [loginWithGoogle, navigate, dest, terms],
  );

  return (
    <AuthCard
      title="Create your account"
      subtitle="Save your orders, track deliveries, and check out faster."
      footer={
        <>
          Want to sell your own merch?{" "}
          <Link to="/sell" className="font-medium text-brand-700 hover:underline">
            Start a store
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

        <TermsCheckbox checked={terms} onChange={setTerms} />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={busy || !canSubmit}>
          {busy ? "Creating…" : "Create account"}
        </Button>
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to={`/login${location.search}`} state={location.state} className="font-medium text-brand-700 hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
