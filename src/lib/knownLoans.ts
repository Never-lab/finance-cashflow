import type { LoanTarget } from "./loans";

/** Owner-known financing contracts (Mediolanum CSV key → metadata). */
export type KnownLoan = {
  key: string;
  contractRef: string;
  label: string;
  totalInstallments: number;
  principalAmount?: number;
  /** Contract end YYYY-MM-DD */
  endDate?: string;
  remainingDebt?: number;
  totalRepaid?: number;
  nextPaymentDate?: string;
};

/** Selfycredit Instant — contratto 00136196 (Nicholas Antinori). */
export const SELFYCREDIT_00136196: KnownLoan = {
  key: "mutuo-740/00136196",
  contractRef: "740/00136196",
  label: "Selfycredit Instant",
  totalInstallments: 36,
  principalAmount: 3500,
  endDate: "2028-11-30",
  /** Sintesi banca — 8 rate pagate, 28 da pagare (ago 2026) */
  remainingDebt: 2792.4,
  totalRepaid: 707.6,
  nextPaymentDate: "2026-08-31",
};

export const KNOWN_LOANS: KnownLoan[] = [SELFYCREDIT_00136196];

export function defaultLoanTargets(): Record<string, LoanTarget> {
  const out: Record<string, LoanTarget> = {};
  for (const loan of KNOWN_LOANS) {
    out[loan.key] = {
      label: loan.label,
      totalInstallments: loan.totalInstallments,
      principalAmount: loan.principalAmount,
      endDate: loan.endDate,
      remainingDebt: loan.remainingDebt,
      totalRepaid: loan.totalRepaid,
      nextPaymentDate: loan.nextPaymentDate,
    };
  }
  return out;
}

/** DB overrides win per-field over built-in defaults. */
export function mergeLoanTargets(stored: Record<string, LoanTarget>): Record<string, LoanTarget> {
  const defaults = defaultLoanTargets();
  const out: Record<string, LoanTarget> = { ...defaults };
  for (const [key, patch] of Object.entries(stored)) {
    out[key] = { ...defaults[key], ...patch };
  }
  return out;
}
