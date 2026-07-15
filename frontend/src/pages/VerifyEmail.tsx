import { MailCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { resendVerification, verifyEmail } from "../api/auth";
import { AuthCard } from "../components/auth/AuthCard";
import { Button } from "../components/ui/Button";
import { apiError } from "../lib/apiError";

type Status = "verifying" | "ok" | "error" | "notice";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>(token ? "verifying" : "notice");
  const [msg, setMsg] = useState("");

  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then(() => setStatus("ok"))
      .catch((e) => {
        setMsg(apiError(e, "This verification link is invalid or has expired."));
        setStatus("error");
      });
  }, [token]);

  async function onResend(e: FormEvent) {
    e.preventDefault();
    await resendVerification(email);
    setResent(true);
  }

  const backToLogin = (
    <Link to="/login" className="font-medium text-brand-700 hover:underline">
      Go to log in
    </Link>
  );

  if (status === "verifying") {
    return (
      <AuthCard title="Verifying your email…">
        <p className="text-sm text-slate-500">One moment.</p>
      </AuthCard>
    );
  }

  if (status === "ok") {
    return (
      <AuthCard title="Email verified" footer={backToLogin}>
        <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">You're all set — you can log in now.</div>
      </AuthCard>
    );
  }

  if (status === "error") {
    return (
      <AuthCard title="Verification failed" footer={backToLogin}>
        <p className="text-sm text-red-600">{msg}</p>
      </AuthCard>
    );
  }

  // notice: "we sent you a link" + resend
  return (
    <AuthCard title="Check your email" footer={backToLogin}>
      <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <p>We've sent a verification link to your inbox. Click it to activate your account.</p>
      </div>
      <form onSubmit={onResend} className="mt-5">
        <label className="label">Didn't get it? Resend to:</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Button type="submit" variant="outline" className="mt-3 w-full">
          {resent ? "Sent — check your inbox" : "Resend verification"}
        </Button>
      </form>
    </AuthCard>
  );
}
