import type { Transaction } from "../types";
import { forConsumption } from "./consumptionView";
import { categoryBreakdown, filterByPeriod } from "./stats";

export const BUDGET_WARN_PCT = 80;
export const BUDGET_OVER_PCT = 100;

export type CategoryBudgets = Record<string, number>;

export type BudgetStatus = "ok" | "warn" | "over";

export type BudgetRow = {
  category: string;
  spent: number;
  limit: number;
  remaining: number;
  pct: number;
  status: BudgetStatus;
};

export type BudgetReport = {
  month: string;
  rows: BudgetRow[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function budgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return "ok";
  const pct = (100 * spent) / limit;
  if (pct >= BUDGET_OVER_PCT) return "over";
  if (pct >= BUDGET_WARN_PCT) return "warn";
  return "ok";
}

export function buildBudgetReport(
  transactions: Transaction[],
  budgets: CategoryBudgets,
  now: Date = new Date(),
): BudgetReport {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthTx = forConsumption(filterByPeriod(transactions, "month", now));
  const spentMap = new Map(categoryBreakdown(monthTx).map((r) => [r.category, r.total]));

  const rows: BudgetRow[] = [];
  for (const [category, rawLimit] of Object.entries(budgets)) {
    const limit = Number(rawLimit);
    if (!Number.isFinite(limit) || limit <= 0) continue;
    const spent = spentMap.get(category) ?? 0;
    const pct = limit > 0 ? round2((100 * spent) / limit) : 0;
    rows.push({
      category,
      spent: round2(spent),
      limit: round2(limit),
      remaining: round2(Math.max(0, limit - spent)),
      pct,
      status: budgetStatus(spent, limit),
    });
  }

  rows.sort((a, b) => {
    const rank = { over: 0, warn: 1, ok: 2 } as const;
    const d = rank[a.status] - rank[b.status];
    if (d !== 0) return d;
    return b.pct - a.pct || a.category.localeCompare(b.category);
  });

  return { month, rows };
}

/** Categories excluded from the "add budget" picker (income / transfer noise). */
export const BUDGET_EXCLUDED_CATEGORIES = new Set([
  "Stipendio",
  "Trasferimenti",
  "Interessi",
  "Prelievi",
  "Investimenti",
]);
