import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  fetchMe,
  googleLogin,
  loginUser,
  registerAccount,
  type AuthIntent,
  type RegisterInput,
  type UserPublic,
} from "./api/auth";
import { getToken, setToken } from "./api/client";

interface AuthState {
  user: UserPublic | null;
  loading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  register: (input: RegisterInput) => Promise<{ verifyRequired: boolean }>;
  loginWithGoogle: (credential: string, remember: boolean, intent?: AuthIntent) => Promise<void>;
  /** Re-fetch the current user (e.g. after gaining a new role). */
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  // Session expired (a 401 from an authenticated request) → drop the user so
  // protected routes redirect to login. Public pages just become logged-out.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  async function login(email: string, password: string, remember: boolean) {
    setToken(await loginUser(email, password, remember), remember);
    setUser(await fetchMe());
  }

  async function register(input: RegisterInput) {
    const res = await registerAccount(input);
    if (res.email_verification_required) {
      // Don't log in until the email is verified — the signup page routes to /verify-email.
      return { verifyRequired: true };
    }
    setToken(res.access_token, true);
    setUser(await fetchMe());
    return { verifyRequired: false };
  }

  async function loginWithGoogle(credential: string, remember: boolean, intent: AuthIntent = "seller") {
    setToken(await googleLogin(credential, remember, intent), remember);
    setUser(await fetchMe());
  }

  async function refreshUser() {
    setUser(await fetchMe());
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
