import type { Period, Transaction } from "../types";

export function filterByPeriod(txns: Transaction[], period: Period, now = new Date()): Transaction[] {
  if (period === "all") return txns;
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  if (period === "month") {
    start.setDate(1);
  } else if (period === "30d") {
    // Inclusive rolling window: today and prior 29 days = 30 calendar days.
    start.setDate(start.getDate() - 29);
  } else {
    start.setMonth(start.getMonth() - 2);
    start.setDate(1);
  }
  const from = toYmd(start);
  const to = toYmd(end);
  return txns.filter((t) => t.date >= from && t.date <= to);
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type Kpis = {
  income: number;
  expense: number; // absolute
  net: number;
  count: number;
};

export function computeKpis(txns: Transaction[]): Kpis {
  let income = 0;
  let expense = 0;
  for (const t of txns) {
    if (t.amount > 0) income += t.amount;
    else expense += -t.amount;
  }
  return { income, expense, net: income - expense, count: txns.length };
}

export function monthlySeries(txns: Transaction[]): { month: string; income: number; expense: number; net: number }[] {
  const map = new Map<string, { income: number; expense: number }>();
  for (const t of txns) {
    const month = t.date.slice(0, 7);
    const cur = map.get(month) ?? { income: 0, expense: 0 };
    if (t.amount > 0) cur.income += t.amount;
    else cur.expense += -t.amount;
    map.set(month, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      income: round2(v.income),
      expense: round2(v.expense),
      net: round2(v.income - v.expense),
    }));
}

export function categoryBreakdown(txns: Transaction[]): { category: string; total: number }[] {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.amount >= 0) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + -t.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total: round2(total) }))
    .sort((a, b) => b.total - a.total);
}

/** Top N categories + Altro, with % of expense total. */
export function categoryBreakdownPct(
  txns: Transaction[],
  topN = 6,
): { category: string; total: number; pct: number }[] {
  const all = categoryBreakdown(txns);
  const sum = all.reduce((s, x) => s + x.total, 0);
  if (sum <= 0) return [];
  const top = all.slice(0, topN);
  const rest = all.slice(topN).reduce((s, x) => s + x.total, 0);
  const rows = top.map((r) => ({
    ...r,
    pct: round2((100 * r.total) / sum),
  }));
  if (rest > 0) {
    rows.push({
      category: "Altro",
      total: round2(rest),
      pct: round2((100 * rest) / sum),
    });
  }
  return rows;
}

/** Daily cumulative net (cash-flow curve, Getquin-style hero). */
export function cumulativeSeries(
  txns: Transaction[],
): { date: string; balance: number; dayNet: number }[] {
  const byDay = new Map<string, number>();
  for (const t of txns) {
    byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount);
  }
  let balance = 0;
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayNet]) => {
      balance += dayNet;
      return { date, dayNet: round2(dayNet), balance: round2(balance) };
    });
}

export type HeatmapData = {
  months: string[];
  categories: string[];
  /** value[monthIndex][catIndex] */
  matrix: number[][];
  max: number;
};

/** Expense intensity by month ├ù top categories. */
export function spendingHeatmap(txns: Transaction[], topCats = 5): HeatmapData {
  const cats = categoryBreakdown(txns)
    .slice(0, topCats)
    .map((c) => c.category);
  const months = [
    ...new Set(txns.filter((t) => t.amount < 0).map((t) => t.date.slice(0, 7))),
  ].sort();
  const idxCat = new Map(cats.map((c, i) => [c, i]));
  const matrix = months.map(() => cats.map(() => 0));
  let max = 0;
  for (const t of txns) {
    if (t.amount >= 0) continue;
    const mi = months.indexOf(t.date.slice(0, 7));
    const ci = idxCat.get(t.category);
    if (mi < 0 || ci === undefined) continue;
    matrix[mi]![ci]! += -t.amount;
    max = Math.max(max, matrix[mi]![ci]!);
  }
  for (let m = 0; m < matrix.length; m++) {
    for (let c = 0; c < (matrix[m]?.length ?? 0); c++) {
      matrix[m]![c] = round2(matrix[m]![c]!);
    }
  }
  return { months, categories: cats, matrix, max: round2(max) };
}

export type SankeyData = {
  nodes: { name: string }[];
  links: { source: number; target: number; value: number }[];
  savingsRate: number; // 0-100
  income: number;
  expense: number;
  net: number;
};

/**
 * Getquin-style cash-flow Sankey:
 * income categories ÔåÆ Entrate ÔåÆ expense categories (+ Risparmio if net > 0).
 */
export function cashflowSankey(txns: Transaction[], topExpenses = 7): SankeyData | null {
  const kpis = computeKpis(txns);
  if (kpis.income <= 0 && kpis.expense <= 0) return null;

  const incomeMap = new Map<string, number>();
  for (const t of txns) {
    if (t.amount <= 0) continue;
    incomeMap.set(t.category, (incomeMap.get(t.category) ?? 0) + t.amount);
  }
  let incomeCats = [...incomeMap.entries()]
    .map(([category, total]) => ({ category, total: round2(total) }))
    .sort((a, b) => b.total - a.total);

  if (incomeCats.length === 0 && kpis.income <= 0) {
    // Expenses only ÔÇö still show a minimal diagram from a synthetic hub
    incomeCats = [{ category: "Entrate (n/d)", total: kpis.expense }];
  }

  const expenses = categoryBreakdownPct(txns, topExpenses);
  const nodes: { name: string }[] = [];
  const links: { source: number; target: number; value: number }[] = [];

  const incomeNodeIdx: number[] = [];
  for (const c of incomeCats) {
    incomeNodeIdx.push(nodes.length);
    nodes.push({ name: `${c.category} ${formatEurCompact(c.total)}` });
  }

  const hubIdx = nodes.length;
  const hubTotal = incomeCats.reduce((s, c) => s + c.total, 0);
  nodes.push({ name: `Entrate ${formatEurCompact(hubTotal)}` });

  for (let i = 0; i < incomeCats.length; i++) {
    links.push({
      source: incomeNodeIdx[i]!,
      target: hubIdx,
      value: Math.max(incomeCats[i]!.total, 0.01),
    });
  }

  for (const e of expenses) {
    const idx = nodes.length;
    nodes.push({ name: `${e.category} ${formatEurCompact(e.total)}` });
    links.push({
      source: hubIdx,
      target: idx,
      value: Math.max(e.total, 0.01),
    });
  }

  if (kpis.net > 0.009) {
    const idx = nodes.length;
    nodes.push({ name: `Margine ${formatEurCompact(kpis.net)}` });
    links.push({ source: hubIdx, target: idx, value: kpis.net });
  } else if (kpis.net < -0.009 && kpis.income > 0) {
    // Deficit: show gap as outflow from hub already covered by expenses > income;
    // add a note node only if expenses exceed what we linked ÔÇö clamp links instead.
  }

  // If expenses > income, sankey values from hub exceed inflow ÔÇö scale expense links
  const outSum = links.filter((l) => l.source === hubIdx).reduce((s, l) => s + l.value, 0);
  const inSum = links.filter((l) => l.target === hubIdx).reduce((s, l) => s + l.value, 0);
  if (outSum > inSum && inSum > 0) {
    const scale = inSum / outSum;
    for (const l of links) {
      if (l.source === hubIdx) l.value = round2(l.value * scale);
    }
  }

  const savingsRate =
    kpis.income > 0 ? round2(Math.max(0, (kpis.net / kpis.income) * 100)) : 0;

  return {
    nodes,
    links,
    savingsRate,
    income: kpis.income,
    expense: kpis.expense,
    net: kpis.net,
  };
}

function formatEurCompact(n: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatEur(n: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}
