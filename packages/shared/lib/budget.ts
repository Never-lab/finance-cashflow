/**
 * Budget mensile per categoria su vista consumo (`consumptionView.forConsumption`).
 *
 * Soglie 80%/100% per warn/over; dati da transazioni SQLite + limiti utente in settings.
 */
import type { Transaction } from "../types";
import { forConsumption } from "./consumptionView";
import { categoryBreakdown, filterByPeriod } from "./stats";

/** Soglia % spesa per stato “warn”. */
export const BUDGET_WARN_PCT = 80;
/** Soglia % spesa per stato “over”. */
export const BUDGET_OVER_PCT = 100;

/** Limite EUR mensile per nome categoria. */
export type CategoryBudgets = Record<string, number>;

export type BudgetStatus = "ok" | "warn" | "over";

/** Riga report budget per una categoria nel mese corrente. */
export type BudgetRow = {
  category: string;
  spent: number;
  limit: number;
  remaining: number;
  pct: number;
  status: BudgetStatus;
};

/** Report completo mese YYYY-MM. */
export type BudgetReport = {
  month: string;
  rows: BudgetRow[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** @param spent - Uscite aggregate categoria @param limit - Tetto mensile EUR */
export function budgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return "ok";
  const pct = (100 * spent) / limit;
  if (pct >= BUDGET_OVER_PCT) return "over";
  if (pct >= BUDGET_WARN_PCT) return "warn";
  return "ok";
}

/**
 * Confronta spesa mese corrente (solo consumo) con budget configurati.
 * @param now - Data di riferimento per calendario mese
 */
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

/** Categorie escluse dal picker “aggiungi budget” (entrate / rumore trasferimenti). */
export const BUDGET_EXCLUDED_CATEGORIES = new Set([
  "Stipendio",
  "Trasferimenti",
  "Interessi",
  "Prelievi",
  "Investimenti",
]);

const SUGGEST_MIN_AVG = 10;

function roundNearest5(n: number): number {
  return Math.round(n / 5) * 5;
}

/**
 * Suggest monthly category limits from average spend over the 3 full
 * calendar months before `now`'s month (consumption view only).
 */
export function suggestCategoryBudgets(
  transactions: Transaction[],
  now: Date = new Date(),
): CategoryBudgets {
  const endExclusive = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
  const toExclusive = `${endExclusive.getFullYear()}-${String(endExclusive.getMonth() + 1).padStart(2, "0")}-01`;

  const windowTx = forConsumption(
    transactions.filter((t) => t.date >= from && t.date < toExclusive),
  );
  const monthsByCat = new Map<string, Set<string>>();
  for (const t of windowTx) {
    if (t.amount >= 0) continue;
    const set = monthsByCat.get(t.category) ?? new Set();
    set.add(t.date.slice(0, 7));
    monthsByCat.set(t.category, set);
  }

  const out: CategoryBudgets = {};
  for (const { category, total } of categoryBreakdown(windowTx)) {
    if (BUDGET_EXCLUDED_CATEGORIES.has(category)) continue;
    const monthCount = Math.max(1, monthsByCat.get(category)?.size ?? 1);
    const avg = total / monthCount;
    if (avg < SUGGEST_MIN_AVG) continue;
    const limit = roundNearest5(avg);
    if (limit < SUGGEST_MIN_AVG) continue;
    out[category] = limit;
  }
  return out;
}
