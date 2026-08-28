import type { PaypalKind } from "./paypal";

/** Owner-known PayPal installment plans (bank CSV key → metadata). */
export type KnownPaypalPlan = {
  key: string;
  label: string;
  kind: PaypalKind;
  /** Match Mediolanum lines: classifyPaypal kind + installment amount */
  matchKind: PaypalKind;
  matchAmount: number;
  /** Extra line amounts that belong to the same installment (e.g. split auth) */
  splitAmounts?: number[];
  totalInstallments: number;
  installmentAmount: number;
  /** From PayPal app — overrides CSV-only counts when set */
  paidCount?: number;
  totalRepaid?: number;
  remainingDebt?: number;
  nextPaymentDate?: string;
  startDate?: string;
  principalAmount?: number;
  totalAmount?: number;
  indicativeTaeg?: number;
};

/** Unieuro — Pay Monthly 24×, acquisto 5 nov 2025. */
export const UNIEURO_PAYMONTHLY: KnownPaypalPlan = {
  key: "paypal-unieuro",
  label: "Unieuro S.p.A.",
  kind: "pay_monthly",
  matchKind: "pay_monthly",
  matchAmount: 23.94,
  totalInstallments: 24,
  installmentAmount: 23.94,
  paidCount: 9,
  totalRepaid: 215.46,
  remainingDebt: 359,
  nextPaymentDate: "2026-09-05",
  startDate: "2025-11-05",
  principalAmount: 499.8,
  totalAmount: 574.46,
  indicativeTaeg: 14.99,
};

/** Autodoc — Paga in 3, acquisto 17 lug 2026. Prima rata splittata 28,13 + 10,33. */
export const AUTODOC_PAYIN3: KnownPaypalPlan = {
  key: "paypal-autodoc",
  label: "Autodoc SE",
  kind: "pay_in_3",
  matchKind: "pay_in_3",
  matchAmount: 38.46,
  splitAmounts: [28.13, 10.33],
  totalInstallments: 3,
  installmentAmount: 38.46,
  paidCount: 2,
  totalRepaid: 76.92,
  remainingDebt: 38.46,
  nextPaymentDate: "2026-09-17",
  startDate: "2026-07-17",
  principalAmount: 115.38,
  totalAmount: 115.38,
};

export const KNOWN_PAYPAL_PLANS: KnownPaypalPlan[] = [UNIEURO_PAYMONTHLY, AUTODOC_PAYIN3];

export function matchKnownPaypalPlan(
  kind: PaypalKind,
  amount: number,
  known: KnownPaypalPlan,
): boolean {
  if (kind !== known.matchKind) return false;
  if (Math.abs(amount - known.matchAmount) < 0.01) return true;
  return known.splitAmounts?.some((a) => Math.abs(amount - a) < 0.01) ?? false;
}
