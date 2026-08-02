import type { Transaction } from "../types";
import { forCashflow } from "./internal";

export type RecurringItem = {
  key: string;
  label: string;
  category: string;
  avgAmount: number;
  months: string[];
  count: number;
  lastDate: string;
  /** Rough monthly burden */
  monthlyEstimate: number;
};

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
    const label = similar[0]?.description ?? key;
    const category = similar[0]?.category ?? "Altro";
    const lastDate = similar.map((t) => t.date).sort().at(-1) ?? "";

    out.push({
      key,
      label,
      category,
      avgAmount: Math.round(avg * 100) / 100,
      months: simMonths.sort(),
      count: similar.length,
      lastDate,
      monthlyEstimate: Math.round(avg * 100) / 100,
    });
  }

  return out.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate);
}
