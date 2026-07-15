import { useCallback, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import { AuthCard, AuthDivider } from "../components/auth/AuthCard";
import { GoogleButton } from "../components/auth/GoogleButton";
import { Button } from "../components/ui/Button";
import { apiError } from "../lib/apiError";

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Read `remember` via a ref so the Google callback stays stable (no button re-init on toggle).
  const rememberRef = useRef(remember);
  rememberRef.current = remember;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password, remember);
      navigate("/dashboard");
    } catch (err) {
      setError(apiError(err, "Incorrect email or password."));
    } finally {
      setBusy(false);
    }
  }

  const onGoogle = useCallback(
    async (credential: string) => {
      setError(null);
      try {
        await loginWithGoogle(credential, rememberRef.current);
        navigate("/dashboard");
      } catch (err) {
        setError(apiError(err, "Google sign-in failed."));
      }
    },
    [loginWithGoogle, navigate],
  );

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to your MyHappinessClub account."
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="font-medium text-brand-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton text="signin_with" onCredential={onGoogle} />
      <AuthDivider />

      <form onSubmit={onSubmit}>
        <label className="label">Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <div className="mt-4">
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
            Forgot password?
          </Link>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthCard>
  );
}
