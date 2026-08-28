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
  startDate?: string;
  /** Indicative TAN % for UI — not contractual */
  indicativeTan?: number;
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

/**
 * Finanziamento auto Avvera — Payment Loan 1076258 (Nicholas Antinori).
 * Rate ~96 (dic 2025 → nov 2033). TAN indicativo ~4%: ipotesi utente; mercato auto 2026 spesso 5–8% TAEG.
 */
export const AVVERA_AUTO_1076258: KnownLoan = {
  key: "avvera-1076258",
  contractRef: "1076258",
  label: "Finanziamento auto Avvera",
  totalInstallments: 96,
  principalAmount: 24109,
  startDate: "2025-10-24",
  endDate: "2033-11-01",
  remainingDebt: 23096.19,
  indicativeTan: 4,
};

export const KNOWN_LOANS: KnownLoan[] = [SELFYCREDIT_00136196, AVVERA_AUTO_1076258];

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
      startDate: loan.startDate,
      indicativeTan: loan.indicativeTan,
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
