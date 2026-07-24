import { api, setToken } from "./client";

export interface Account {
  personal: {
    first_name: string;
    last_name: string;
    display_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    email_verified: boolean;
  };
  business: {
    brand_name: string | null;
    tax_id: string | null;
    country: string | null;
    currency: string | null;
  };
  store: { slug: string | null; is_published: boolean };
  preferences: {
    language: string;
    currency: string;
    timezone: string | null;
    email_notifications: boolean;
    marketing_emails: boolean;
  };
  security: {
    has_password: boolean;
    connected_google: boolean;
    session_started: string | null;
    sessions_revoked_at: string | null;
  };
}

export async function getAccount(): Promise<Account> {
  return (await api.get<Account>("/settings")).data;
}

export async function updateProfile(patch: {
  first_name?: string;
  last_name?: string;
  phone?: string;
}): Promise<Account> {
  return (await api.patch<Account>("/settings/profile", patch)).data;
}

export async function uploadAvatar(file: File): Promise<Account> {
  const form = new FormData();
  form.append("file", file);
  return (await api.post<Account>("/settings/avatar", form)).data;
}

export async function removeAvatar(): Promise<Account> {
  return (await api.delete<Account>("/settings/avatar")).data;
}

export async function updateBusiness(patch: {
  tax_id?: string;
  country?: string;
  currency?: string;
}): Promise<Account> {
  return (await api.patch<Account>("/settings/business", patch)).data;
}

export async function updatePreferences(patch: {
  language?: string;
  currency?: string;
  timezone?: string;
  email_notifications?: boolean;
  marketing_emails?: boolean;
}): Promise<Account> {
  return (await api.patch<Account>("/settings/preferences", patch)).data;
}

// ── saved addresses ───────────────────────────────────────────────────────────

export type AddressType = "SHIPPING" | "BILLING";

export interface Address {
  id: string;
  address_type: AddressType;
  is_default: boolean;
  full_name: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postal_code: string;
  country: string;
}

export interface AddressInput {
  address_type: AddressType;
  is_default: boolean;
  use_for_both?: boolean;
  full_name: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postal_code: string;
  country: string;
}

export async function getAddresses(): Promise<Address[]> {
  return (await api.get<Address[]>("/settings/addresses")).data;
}

export async function createAddress(input: AddressInput): Promise<Address[]> {
  return (await api.post<Address[]>("/settings/addresses", input)).data;
}

export async function updateAddress(id: string, patch: Partial<AddressInput>): Promise<Address[]> {
  return (await api.patch<Address[]>(`/settings/addresses/${id}`, patch)).data;
}

export async function deleteAddress(id: string): Promise<Address[]> {
  return (await api.delete<Address[]>(`/settings/addresses/${id}`)).data;
}

/** Changes the password and rotates this device's token (all others log out). */
export async function changePassword(currentPassword: string | null, newPassword: string): Promise<void> {
  const res = await api.post<{ access_token: string }>("/settings/password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  setToken(res.data.access_token, true);
}

export async function changeEmail(newEmail: string, currentPassword: string): Promise<Account> {
  return (
    await api.post<Account>("/settings/email", {
      new_email: newEmail,
      current_password: currentPassword,
    })
  ).data;
}

/** Kills every other session; this device gets a fresh token. */
export async function logoutEverywhere(): Promise<void> {
  const res = await api.post<{ access_token: string }>("/settings/logout-all");
  setToken(res.data.access_token, true);
}
