import { describe, expect, it } from "vitest";
import { analyzeFinances } from "./advisor";
import type { Transaction } from "../types";

function tx(
  partial: Partial<Transaction> &
    Pick<Transaction, "id" | "date" | "description" | "amount" | "category">,
): Transaction {
  return {
    currency: "EUR",
    source: "mediolanum",
    internal: false,
    ...partial,
  };
}

describe("analyzeFinances", () => {
  it("flags low savings and returns a score", () => {
    const rows: Transaction[] = [
      tx({ id: "1", date: "2026-08-01", description: "Stipendio", amount: 1000, category: "Stipendio" }),
      tx({ id: "2", date: "2026-08-02", description: "Spesa varia", amount: -980, category: "Spesa" }),
    ];
    const r = analyzeFinances(rows, { now: new Date(2026, 7, 15), period: "month" });
    expect(r.score).toBeLessThan(90);
    expect(r.insights.some((i) => i.id === "savings-low" || i.id === "savings-mid")).toBe(true);
  });

  it("detects recurring burden using avg monthly income", () => {
    const rows: Transaction[] = [
      tx({ id: "i", date: "2026-08-01", description: "Stipendio", amount: 2000, category: "Stipendio" }),
      tx({ id: "i2", date: "2026-07-01", description: "Stipendio", amount: 2000, category: "Stipendio" }),
      tx({ id: "i3", date: "2026-06-01", description: "Stipendio", amount: 2000, category: "Stipendio" }),
      ...["2026-06-01", "2026-07-01", "2026-08-01"].flatMap((d, idx) => [
        tx({ id: `a${idx}`, date: d, description: "Netflix", amount: -15.99, category: "Abbonamenti" }),
        tx({ id: `b${idx}`, date: d, description: "Palestra Fit", amount: -60, category: "Salute" }),
        tx({ id: `c${idx}`, date: d, description: "Sky TV", amount: -30, category: "Abbonamenti" }),
        tx({ id: `d${idx}`, date: d, description: "Spotify", amount: -10, category: "Abbonamenti" }),
        tx({ id: `e${idx}`, date: d, description: "Disney+", amount: -12, category: "Abbonamenti" }),
        tx({ id: `f${idx}`, date: d, description: "iCloud", amount: -3, category: "Abbonamenti" }),
        tx({ id: `g${idx}`, date: d, description: "Dazn", amount: -30, category: "Abbonamenti" }),
        tx({ id: `h${idx}`, date: d, description: "Prime", amount: -5, category: "Abbonamenti" }),
      ]),
    ];
    const r = analyzeFinances(rows, { now: new Date(2026, 7, 15), period: "3m" });
    expect(r.summary.avgMonthlyIncome).toBe(2000);
    expect(r.insights.some((i) => i.kind === "recurring")).toBe(true);
  });

  it("includes loan monthly in impegni burden", () => {
    const mutuoDesc =
      "PAG. MUTUO/FIN. VARI NUM. 740/00136196 R.008 06740001361960000000000 D";
    const rows: Transaction[] = [
      tx({ id: "i", date: "2026-08-01", description: "Stipendio", amount: 1500, category: "Stipendio" }),
      tx({ id: "l1", date: "2026-07-31", description: mutuoDesc, amount: -109.6, category: "Mutuo" }),
      tx({ id: "l2", date: "2026-08-31", description: mutuoDesc, amount: -109.6, category: "Mutuo" }),
    ];
    const r = analyzeFinances(rows, { now: new Date(2026, 7, 15), period: "3m" });
    expect(r.impegni.loanMonthly).toBeGreaterThan(0);
    expect(r.impegni.monthlyBurden).toBeGreaterThanOrEqual(r.impegni.loanMonthly);
  });

  it("returns top actions for leak insights", () => {
    const rows: Transaction[] = [
      tx({ id: "1", date: "2026-08-01", description: "Stipendio", amount: 1000, category: "Stipendio" }),
      tx({ id: "2", date: "2026-08-02", description: "Spesa", amount: -990, category: "Spesa" }),
    ];
    const r = analyzeFinances(rows, { now: new Date(2026, 7, 15), period: "month" });
    expect(r.topActions.length).toBeGreaterThan(0);
    expect(r.topActions.every((a) => a.action)).toBe(true);
  });

  it("adds portfolio insight when PAC active and savings low", () => {
    const rows: Transaction[] = [
      tx({ id: "1", date: "2026-08-01", description: "Stipendio", amount: 1000, category: "Stipendio" }),
      tx({ id: "2", date: "2026-08-02", description: "Spesa", amount: -970, category: "Spesa" }),
    ];
    const r = analyzeFinances(rows, {
      now: new Date(2026, 7, 15),
      period: "month",
      portfolio: { totalContributed: 650, totalValue: 700, pnl: 50 },
    });
    expect(r.insights.some((i) => i.id === "invest-low-savings")).toBe(true);
  });

  it("computes score delta without infinite recursion", () => {
    const rows: Transaction[] = [
      tx({ id: "1", date: "2026-08-01", description: "Stipendio", amount: 2000, category: "Stipendio" }),
      tx({ id: "2", date: "2026-07-01", description: "Stipendio", amount: 2000, category: "Stipendio" }),
      tx({ id: "3", date: "2026-08-05", description: "Spesa", amount: -500, category: "Spesa" }),
    ];
    const r = analyzeFinances(rows, { now: new Date(2026, 7, 15), period: "3m" });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
