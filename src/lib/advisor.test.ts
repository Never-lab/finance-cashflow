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
    const r = analyzeFinances(rows, { now: new Date(2026, 7, 15) });
    expect(r.score).toBeLessThan(90);
    expect(r.insights.some((i) => i.id === "savings-low" || i.id === "savings-mid")).toBe(true);
  });

  it("detects recurring burden", () => {
    const rows: Transaction[] = [
      tx({ id: "i", date: "2026-08-01", description: "Stipendio", amount: 2000, category: "Stipendio" }),
      tx({ id: "a1", date: "2026-06-01", description: "Netflix", amount: -15.99, category: "Abbonamenti" }),
      tx({ id: "a2", date: "2026-07-01", description: "Netflix", amount: -15.99, category: "Abbonamenti" }),
      tx({ id: "a3", date: "2026-08-01", description: "Netflix", amount: -15.99, category: "Abbonamenti" }),
      tx({ id: "b1", date: "2026-06-05", description: "Palestra Fit", amount: -60, category: "Salute" }),
      tx({ id: "b2", date: "2026-07-05", description: "Palestra Fit", amount: -60, category: "Salute" }),
      tx({ id: "b3", date: "2026-08-05", description: "Palestra Fit", amount: -60, category: "Salute" }),
      tx({ id: "c1", date: "2026-06-10", description: "Sky TV", amount: -30, category: "Abbonamenti" }),
      tx({ id: "c2", date: "2026-07-10", description: "Sky TV", amount: -30, category: "Abbonamenti" }),
      tx({ id: "c3", date: "2026-08-10", description: "Sky TV", amount: -30, category: "Abbonamenti" }),
    ];
    const r = analyzeFinances(rows, { now: new Date(2026, 7, 15) });
    expect(r.insights.some((i) => i.kind === "recurring")).toBe(true);
  });
});
