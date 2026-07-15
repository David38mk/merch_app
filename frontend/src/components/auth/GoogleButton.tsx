import { useEffect, useRef, useState } from "react";

import { googleConfig } from "../../api/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
  return gisPromise;
}

function GoogleG() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

export function GoogleButton({
  text = "signin_with",
  onCredential,
}: {
  text?: "signin_with" | "signup_with" | "continue_with";
  onCredential: (credential: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    googleConfig()
      .then(async (cfg) => {
        if (cancelled) return;
        if (!cfg.enabled || !cfg.client_id) {
          setEnabled(false);
          return;
        }
        setEnabled(true);
        await loadGis();
        if (cancelled || !ref.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: cfg.client_id,
          callback: (r) => onCredential(r.credential),
        });
        window.google.accounts.id.renderButton(ref.current, { theme: "outline", size: "large", width: 320, text });
      })
      .catch(() => setEnabled(false));
    return () => {
      cancelled = true;
    };
  }, [onCredential, text]);

  if (enabled === null) {
    return <div className="h-10 animate-pulse rounded-lg bg-slate-100" />;
  }
  if (!enabled) {
    return (
      <button
        type="button"
        disabled
        title="Set GOOGLE_CLIENT_ID in the backend .env to enable Google sign-in"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-400"
      >
        <GoogleG /> Continue with Google
        <span className="text-xs text-slate-300">(not configured)</span>
      </button>
    );
  }
  return <div ref={ref} className="flex justify-center" />;
}
