import { Plan } from "@prisma/client";

const COMMISSION_RATES: Record<Plan, number> = {
  FREE: 0.15,
  CREATOR: 0.10,
  PRO: 0.05,
};

export function getCommissionRate(plan: Plan): number {
  return COMMISSION_RATES[plan];
}

export function calculateCommission(subtotal: number, plan: Plan): number {
  return Math.round(subtotal * getCommissionRate(plan) * 100) / 100;
}

export const PLAN_PRODUCT_LIMITS: Record<Plan, number | null> = {
  FREE: 5,
  CREATOR: null,
  PRO: null,
};
