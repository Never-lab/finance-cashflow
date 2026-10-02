import type { Transaction } from "../types";
import { forCashflow } from "./internal";
import { recurringKey } from "./recurring";
import { carLoanKeyFromDescription, isCarLoanTransaction } from "./carLoan";

export type LoanTarget = {
  /** Total scheduled installments (e.g. 36 for Selfycredit) */
  totalInstallments?: number;
  /** Optional display label */
  label?: string;
  /** Original disbursed amount (EUR) */
  principalAmount?: number;
  /** Contract end YYYY-MM-DD */
  endDate?: string;
  /** Debito residuo from bank (preferred over rate ├ù count estimate) */
  remainingDebt?: number;
  /** Totale restituito from bank sintesi */
  totalRepaid?: number;
  /** Next installment YYYY-MM-DD */
  nextPaymentDate?: string;
  /** Contract start YYYY-MM-DD */
  startDate?: string;
  /** Display-only reference TAN (not from contract PDF) */
  indicativeTan?: number;
};

export type LoanPlan = {
  key: string;
  label: string;
  contractRef: string | null;
  installmentAmount: number;
  paidCount: number;
  totalPaid: number;
  monthlyBurden: number;
  firstDate: string;
  lastDate: string;
  dates: string[];
  totalInstallments: number | null;
  remainingInstallments: number | null;
  remainingEstimate: number | null;
  /** bank = debito residuo banca; estimate = rate mancanti ├ù rata */
  remainingSource: "bank" | "estimate" | null;
  principalAmount: number | null;
  endDate: string | null;
  totalRepaidBank: number | null;
  nextPaymentDate: string | null;
  startDate: string | null;
  /** Indicative TAN % ÔÇö not from bank extract */
  indicativeTan: number | null;
  transactions: Transaction[];
};

export type LoanSummary = {
  plans: LoanPlan[];
  monthlyBurden: number;
  remainingDebt: number;
  totalPaid: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Extract contract ref from Mediolanum mutuo lines (NUM. 740/00136196). */
export function loanKeyFromDescription(description: string): string | null {
  const carKey = carLoanKeyFromDescription(description);
  if (carKey) return carKey;
  const numMatch = description.match(/NUM\.\s*([\d/]+)/i);
  if (numMatch) return `mutuo-${numMatch[1]}`;
  if (/pag\.\s*mutuo|fin\.\s*vari|prestito|mutui\s*-\s*prestiti/i.test(description)) {
    const k = recurringKey(description);
    return k.length >= 3 ? `loan-${k.slice(0, 32)}` : null;
  }
  return null;
}

export function isLoanTransaction(t: Transaction): boolean {
  if (isCarLoanTransaction(t)) return true;
  if (t.category === "Mutuo" || t.category === "Finanziamento auto") return true;
  return /pag\.\s*mutuo|fin\.\s*vari|prestito/i.test(t.description);
}

function contractRefFromDescription(description: string): string | null {
  const m = description.match(/NUM\.\s*([\d/]+)/i);
  return m?.[1] ?? null;
}

function defaultLabel(ref: string | null, description: string): string {
  if (/avvera/i.test(description) && /payment loan/i.test(description)) {
    const m = description.match(/payment loan\s+n\.?\s*(\d+)/i);
    return m ? `Fin. auto Avvera ${m[1]}` : "Finanziamento auto Avvera";
  }
  if (ref) return `Mutuo ${ref}`;
  const short = description.slice(0, 48).trim();
  return short || "Prestito";
}

/** Group mutuo/prestito outflows; remaining debt needs totalInstallments in targets. */
export function buildLoanSummary(
  txns: Transaction[],
  targets: Record<string, LoanTarget> = {},
): LoanSummary {
  const expenses = forCashflow(txns).filter((t) => t.amount < 0 && isLoanTransaction(t));
  const buckets = new Map<string, Transaction[]>();

  for (const t of expenses) {
    const key = loanKeyFromDescription(t.description);
    if (!key) continue;
    const list = buckets.get(key) ?? [];
    list.push(t);
    buckets.set(key, list);
  }

  const plans: LoanPlan[] = [];
  for (const [key, list] of buckets) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const amounts = sorted.map((t) => round2(-t.amount));
    const installmentAmount = amounts[Math.floor(amounts.length / 2)] ?? 0;
    const paidCount = sorted.length;
    const totalPaid = round2(sorted.reduce((s, t) => s + -t.amount, 0));
    const dates = sorted.map((t) => t.date);
    const ref = contractRefFromDescription(sorted[0]!.description);
    const target = targets[key];
    const totalInstallments =
      target?.totalInstallments != null && target.totalInstallments > 0
        ? target.totalInstallments
        : null;

    let remainingInstallments: number | null = null;
    let remainingEstimate: number | null = null;
    let remainingSource: LoanPlan["remainingSource"] = null;

    if (totalInstallments != null) {
      remainingInstallments = Math.max(0, totalInstallments - paidCount);
    }

    const bankRemaining =
      target?.remainingDebt != null && target.remainingDebt >= 0
        ? round2(target.remainingDebt)
        : null;

    if (remainingInstallments === 0) {
      // paidCount >= totalInstallments ÔÇö ignore stale bank snapshot
      remainingEstimate = 0;
      remainingSource = bankRemaining != null ? "bank" : "estimate";
    } else if (bankRemaining != null) {
      remainingEstimate = bankRemaining;
      remainingSource = "bank";
    } else if (remainingInstallments != null) {
      remainingEstimate = round2(remainingInstallments * installmentAmount);
      remainingSource = "estimate";
    }

    const monthlyBurden = remainingEstimate === 0 ? 0 : installmentAmount;

    plans.push({
      key,
      label: target?.label?.trim() || defaultLabel(ref, sorted[0]!.description),
      contractRef: ref,
      installmentAmount,
      paidCount,
      totalPaid,
      monthlyBurden,
      firstDate: dates[0] ?? "",
      lastDate: dates.at(-1) ?? "",
      dates,
      totalInstallments,
      remainingInstallments,
      remainingEstimate,
      remainingSource,
      principalAmount: target?.principalAmount ?? null,
      endDate: target?.endDate ?? null,
      totalRepaidBank: target?.totalRepaid != null ? round2(target.totalRepaid) : null,
      nextPaymentDate: target?.nextPaymentDate ?? null,
      startDate: target?.startDate ?? null,
      indicativeTan: target?.indicativeTan ?? null,
      transactions: sorted,
    });
  }

  plans.sort((a, b) => b.lastDate.localeCompare(a.lastDate));

  const monthlyBurden = round2(plans.reduce((s, p) => s + p.monthlyBurden, 0));
  const remainingDebt = round2(
    plans.filter((p) => p.remainingEstimate != null).reduce((s, p) => s + (p.remainingEstimate ?? 0), 0),
  );
  const totalPaid = round2(plans.reduce((s, p) => s + p.totalPaid, 0));

  return { plans, monthlyBurden, remainingDebt, totalPaid };
}
