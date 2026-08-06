import { api } from "./client";

export type Role = "BUYER" | "SELLER" | "DESIGNER" | "PRINTSHOP";

export interface UserPublic {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  roles: Role[];
  email_verified: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  email_verification_required: boolean;
}

export type AuthIntent = "buyer" | "seller" | "designer";

export interface RegisterInput {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  intent: AuthIntent;
  accept_terms: boolean;
  accept_designer_agreement?: boolean;
}

export async function registerAccount(input: RegisterInput): Promise<TokenResponse> {
  return (await api.post<TokenResponse>("/auth/register", input)).data;
}

export async function loginUser(email: string, password: string, remember: boolean): Promise<string> {
  const body = new URLSearchParams({ username: email, password, remember: String(remember) });
  const { data } = await api.post<TokenResponse>("/auth/login", body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data.access_token;
}

export async function googleLogin(
  credential: string,
  remember: boolean,
  intent: AuthIntent = "seller",
): Promise<string> {
  const { data } = await api.post<TokenResponse>("/auth/google", { credential, remember, intent });
  return data.access_token;
}

export async function fetchMe(): Promise<UserPublic> {
  return (await api.get<UserPublic>("/auth/me")).data;
}

export async function forgotPassword(email: string): Promise<{ detail: string; dev_reset_url: string | null }> {
  return (await api.post("/auth/forgot-password", { email })).data;
}

export async function resetPassword(token: string, newPassword: string): Promise<{ detail: string }> {
  return (await api.post("/auth/reset-password", { token, new_password: newPassword })).data;
}

export async function verifyEmail(token: string): Promise<{ detail: string }> {
  return (await api.post("/auth/verify-email", { token })).data;
}

export async function resendVerification(email: string): Promise<{ detail: string }> {
  return (await api.post("/auth/resend-verification", { email })).data;
}

export async function googleConfig(): Promise<{ enabled: boolean; client_id: string }> {
  return (await api.get("/auth/google/config")).data;
}
