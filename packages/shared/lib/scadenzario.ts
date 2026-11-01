/**
 * Unified upcoming dues: loans, PayPal installments, subscriptions, vault deadlines.
 */
import type { RecurringMark, Transaction } from "../types";
import { mergeLoanTargets } from "./knownLoans";
import { buildLoanSummary, type LoanTarget } from "./loans";
import { buildPaypalSummary, type PaypalTarget } from "./paypal";
import { findRecurring, isSubscriptionLike } from "./recurring";
import { buildVaultGoals, type VaultBalancesOverride } from "./vaultGoals";

export type ScadenzaKind = "loan" | "paypal" | "subscription" | "vault";

export type ScadenzaItem = {
  id: string;
  kind: ScadenzaKind;
  label: string;
  dueDate: string; // YYYY-MM-DD
  amount: number | null; // EUR outflow estimate; vault may be remaining hint
  sourceTab: "mutui" | "paypal" | "abbonamenti" | "piano";
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toIsoDay(d: Date): string {
  // Local calendar day (matches budget/vault month helpers; not UTC).
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysIso(date: string, days: number): string {
  const [ys, ms, ds] = date.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) return date;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function inHorizon(due: string, today: string, end: string): boolean {
  return due >= today && due <= end;
}

/** Collect dues in [today, today+horizonDays]; sort by date; KPI totals. */
export function buildScadenzario(opts: {
  transactions: Transaction[];
  recurringMarks?: Record<string, RecurringMark>;
  loanTargets?: Record<string, LoanTarget>;
  paypalTargets?: Record<string, PaypalTarget>;
  vaultBalances?: VaultBalancesOverride;
  now?: Date;
  horizonDays?: number;
}): { items: ScadenzaItem[]; totalDue: number; monthBurden: number } {
  const now = opts.now ?? new Date();
  const today = toIsoDay(now);
  const horizon = opts.horizonDays ?? 60;
  const end = addDaysIso(today, horizon);
  const monthPrefix = today.slice(0, 7);
  const marks = opts.recurringMarks ?? {};
  const items: ScadenzaItem[] = [];

  const loans = buildLoanSummary(
    opts.transactions,
    mergeLoanTargets(opts.loanTargets ?? {}),
  );
  for (const p of loans.plans) {
    if (!p.nextPaymentDate) continue;
    if (p.remainingEstimate === 0 || p.remainingInstallments === 0) continue;
    if (!inHorizon(p.nextPaymentDate, today, end)) continue;
    items.push({
      id: `loan:${p.key}`,
      kind: "loan",
      label: p.label,
      dueDate: p.nextPaymentDate,
      amount: p.installmentAmount > 0 ? p.installmentAmount : null,
      sourceTab: "mutui",
    });
  }

  const paypal = buildPaypalSummary(opts.transactions, opts.paypalTargets ?? {});
  for (const p of paypal.plans) {
    if (p.status === "likely_done") continue;
    if (!p.nextPaymentDate) continue;
    if (p.remainingEstimate === 0) continue;
    if (!inHorizon(p.nextPaymentDate, today, end)) continue;
    items.push({
      id: `paypal:${p.key}`,
      kind: "paypal",
      label: p.label,
      dueDate: p.nextPaymentDate,
      amount: p.installmentAmount > 0 ? p.installmentAmount : null,
      sourceTab: "paypal",
    });
  }

  for (const r of findRecurring(opts.transactions).filter(isSubscriptionLike)) {
    if (marks[r.key] === "cancelled") continue;
    const due = r.nextDue ?? null;
    if (!due || !inHorizon(due, today, end)) continue;
    const amount = r.avgAmount > 0 ? r.avgAmount : r.monthlyEstimate > 0 ? r.monthlyEstimate : null;
    items.push({
      id: `sub:${r.key}`,
      kind: "subscription",
      label: r.label,
      dueDate: due,
      amount,
      sourceTab: "abbonamenti",
    });
  }

  for (const g of buildVaultGoals(opts.transactions, opts.vaultBalances ?? {}, now)) {
    if (!g.deadline || !inHorizon(g.deadline, today, end)) continue;
    items.push({
      id: `vault:${g.id}`,
      kind: "vault",
      label: g.label,
      dueDate: g.deadline,
      amount: g.remaining > 0 ? g.remaining : null,
      sourceTab: "piano",
    });
  }

  items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.label.localeCompare(b.label));

  // Vault remaining is a goal gap, not an installment — exclude from "to pay" KPIs.
  const payable = (i: ScadenzaItem) => i.kind !== "vault";
  const totalDue = round2(
    items.filter(payable).reduce((s, i) => s + (i.amount ?? 0), 0),
  );
  const monthBurden = round2(
    items
      .filter((i) => payable(i) && i.dueDate.startsWith(monthPrefix))
      .reduce((s, i) => s + (i.amount ?? 0), 0),
  );

  return { items, totalDue, monthBurden };
}
