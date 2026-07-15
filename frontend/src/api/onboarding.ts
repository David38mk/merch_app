import { api } from "./client";

export type AccountType = "PERSONAL" | "COMPANY";

export interface OnboardingState {
  completed: boolean;
  brand_name: string | null;
  creator_name: string | null;
  country: string | null;
  currency: string | null;
  account_type: AccountType | null;
}

export interface OnboardingUpdate {
  brand_name?: string;
  creator_name?: string;
  country?: string;
  currency?: string;
  account_type?: AccountType;
}

export async function getOnboarding(): Promise<OnboardingState> {
  return (await api.get<OnboardingState>("/seller/onboarding")).data;
}

export async function saveOnboarding(update: OnboardingUpdate): Promise<OnboardingState> {
  return (await api.patch<OnboardingState>("/seller/onboarding", update)).data;
}

export async function completeOnboarding(update: OnboardingUpdate): Promise<OnboardingState> {
  return (await api.post<OnboardingState>("/seller/onboarding/complete", update)).data;
}
