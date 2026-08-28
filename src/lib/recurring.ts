import type { Transaction } from "../types";
import { forCashflow } from "./internal";
import { isFuelPurchase } from "./fuel";

export type RecurringItem = {
  key: string;
  label: string;
  category: string;
  avgAmount: number;
  months: string[];
  count: number;
  lastDate: string;
  /** Amortized monthly burden (not raw installment for semi-annual/quarterly) */
  monthlyEstimate: number;
};

const INSURANCE_RE =
  /allianz|assicur|unipol|generali|\baxa\b|reale mutua|payment loan/i;

const NON_SUBSCRIPTION_CATEGORIES = new Set([
  "Assicurazioni",
  "Mutuo",
  "Finanziamento auto",
  "Affitto",
  "Bollette",
  "Stipendio",
  "Trasferimenti",
  "Trasporti",
]);

/** Normalize merchant-ish label for grouping. */
export function recurringKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/·\s*(risparmi|deposito|attuale)\b/gi, "")
    .replace(/\d+/g, " ")
    .replace(/[^a-zàèéìòù\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

/** True for cancellable subs (Netflix, gym) — not insurance, mutuo, bonifici SDD. */
export function isSubscriptionLike(item: RecurringItem): boolean {
  if (NON_SUBSCRIPTION_CATEGORIES.has(item.category)) return false;
  const hay = `${item.label} ${item.key}`;
  if (INSURANCE_RE.test(hay)) return false;
  if (isFuelPurchase(hay)) return false;
  if (/bonifico|sepa ist|sepa instant|c\/o benef|disposizione vs/i.test(hay)) return false;
  return true;
}

function medianGapDays(dates: string[]): number {
  if (dates.length < 2) return 30;
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const d0 = new Date(dates[i - 1]!);
    const d1 = new Date(dates[i]!);
    gaps.push(Math.max(1, (d1.getTime() - d0.getTime()) / 86_400_000));
  }
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] ?? 30;
}

/** Spread installment amount over typical cadence (semi-annual ≠ full amount / month). */
export function estimateMonthlyBurden(avgInstallment: number, dates: string[]): number {
  if (avgInstallment <= 0) return 0;
  const gap = medianGapDays(dates.sort());
  if (gap <= 35) return avgInstallment;
  const monthly = (avgInstallment * 30) / gap;
  return Math.round(monthly * 100) / 100;
}

/**
 * Recurring outflows: same key in ≥2 distinct months, amounts within 25% of median.
 * Uses cash-flow rows only (no internal transfers).
 */
export function findRecurring(txns: Transaction[]): RecurringItem[] {
  const expenses = forCashflow(txns).filter((t) => t.amount < 0);
  const byKey = new Map<string, Transaction[]>();

  for (const t of expenses) {
    const key = recurringKey(t.description);
    if (key.length < 3) continue;
    const list = byKey.get(key) ?? [];
    list.push(t);
    byKey.set(key, list);
  }

  const out: RecurringItem[] = [];
  for (const [key, list] of byKey) {
    const months = [...new Set(list.map((t) => t.date.slice(0, 7)))].sort();
    if (months.length < 2 && list.length < 3) continue;

    const amounts = list.map((t) => -t.amount).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)] ?? 0;
    if (median <= 0) continue;

    const similar = list.filter((t) => {
      const a = -t.amount;
      return Math.abs(a - median) / median <= 0.25;
    });
    const simMonths = [...new Set(similar.map((t) => t.date.slice(0, 7)))];
    if (simMonths.length < 2 && similar.length < 3) continue;

    const avg =
      similar.reduce((s, t) => s + -t.amount, 0) / Math.max(similar.length, 1);
    const dates = similar.map((t) => t.date);
    const label = similar[0]?.description ?? key;
    const category = similar[0]?.category ?? "Altro";
    const lastDate = dates.sort().at(-1) ?? "";

    out.push({
      key,
      label,
      category,
      avgAmount: Math.round(avg * 100) / 100,
      months: simMonths.sort(),
      count: similar.length,
      lastDate,
      monthlyEstimate: estimateMonthlyBurden(avg, dates),
    });
  }

  return out.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate);
}
