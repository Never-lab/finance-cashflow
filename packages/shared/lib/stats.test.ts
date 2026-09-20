import { describe, expect, it } from "vitest";
import {
  categoryBreakdown,
  categoryBreakdownPct,
  cashflowSankey,
  computeKpis,
  cumulativeSeries,
  filterByPeriod,
  monthlySeries,
  spendingHeatmap,
} from "./stats";
import type { Transaction } from "../types";

const txns: Transaction[] = [
  {
    id: "1",
    date: "2026-01-05",
    description: "A",
    amount: 1000,
    currency: "EUR",
    source: "revolut",
    category: "Stipendio",
  },
  {
    id: "2",
    date: "2026-01-10",
    description: "B",
    amount: -200,
    currency: "EUR",
    source: "revolut",
    category: "Spesa",
  },
  {
    id: "3",
    date: "2026-02-01",
    description: "C",
    amount: -50,
    currency: "EUR",
    source: "mediolanum",
    category: "Spesa",
  },
];

describe("stats", () => {
  it("computes kpis", () => {
    expect(computeKpis(txns)).toEqual({ income: 1000, expense: 250, net: 750, count: 3 });
  });

  it("monthly series", () => {
    const s = monthlySeries(txns);
    expect(s).toHaveLength(2);
    expect(s[0].month).toBe("2026-01");
    expect(s[0].net).toBe(800);
  });

  it("category breakdown expenses only", () => {
    const b = categoryBreakdown(txns);
    expect(b[0]).toEqual({ category: "Spesa", total: 250 });
  });

  it("filters period", () => {
    const now = new Date(2026, 1, 15); // Feb 15 2026
    expect(filterByPeriod(txns, "month", now)).toHaveLength(1);
    expect(filterByPeriod(txns, "all", now)).toHaveLength(3);
  });

  it("cumulative series", () => {
    const c = cumulativeSeries(txns);
    expect(c.at(-1)?.balance).toBe(750);
  });

  it("category pct + heatmap", () => {
    const pct = categoryBreakdownPct(txns, 6);
    expect(pct[0]?.category).toBe("Spesa");
    expect(pct[0]?.pct).toBe(100);
    const heat = spendingHeatmap(txns, 3);
    expect(heat.categories).toContain("Spesa");
    expect(heat.months.length).toBe(2);
  });

  it("builds sankey income → hub → expenses + savings", () => {
    const s = cashflowSankey(txns, 6);
    expect(s).not.toBeNull();
    expect(s!.links.length).toBeGreaterThan(1);
    expect(s!.nodes.some((n) => n.name.startsWith("Margine"))).toBe(true);
    expect(s!.savingsRate).toBe(75);
  });
});
