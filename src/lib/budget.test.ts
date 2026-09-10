import { describe, expect, it } from "vitest";
import type { Transaction } from "../types";
import {
  BUDGET_OVER_PCT,
  BUDGET_WARN_PCT,
  budgetStatus,
  buildBudgetReport,
} from "./budget";

function tx(
  partial: Partial<Transaction> &
    Pick<Transaction, "id" | "date" | "description" | "amount" | "category">,
): Transaction {
  return {
    currency: "EUR",
    source: "revolut",
    internal: false,
    ...partial,
  };
}

describe("budgetStatus", () => {
  it("is ok below warn threshold", () => {
    expect(budgetStatus(79, 100)).toBe("ok");
  });

  it("is warn at 80% inclusive", () => {
    expect(budgetStatus(80, 100)).toBe("warn");
    expect(budgetStatus(99.9, 100)).toBe("warn");
  });

  it("is over at 100%", () => {
    expect(budgetStatus(100, 100)).toBe("over");
    expect(budgetStatus(150, 100)).toBe("over");
  });
});

describe("buildBudgetReport", () => {
  const now = new Date(2026, 8, 15); // Sep 2026 local

  it("sums consumption spend for budgeted categories in current month", () => {
    const rows = [
      tx({ id: "1", date: "2026-09-02", description: "Esselunga", amount: -40, category: "Spesa" }),
      tx({ id: "2", date: "2026-09-03", description: "Esselunga", amount: -30, category: "Spesa" }),
      tx({ id: "3", date: "2026-08-20", description: "Old", amount: -200, category: "Spesa" }),
      tx({
        id: "4",
        date: "2026-09-04",
        description: "Giroconto",
        amount: -50,
        category: "Trasferimenti",
        internal: true,
      }),
      tx({ id: "5", date: "2026-09-05", description: "Netflix", amount: -16, category: "Abbonamenti" }),
    ];
    const report = buildBudgetReport(rows, { Spesa: 100, Abbonamenti: 25 }, now);
    expect(report.month).toBe("2026-09");
    expect(report.rows).toHaveLength(2);
    const spesa = report.rows.find((r) => r.category === "Spesa")!;
    expect(spesa.spent).toBe(70);
    expect(spesa.limit).toBe(100);
    expect(spesa.pct).toBe(70);
    expect(spesa.status).toBe("ok");
    const abb = report.rows.find((r) => r.category === "Abbonamenti")!;
    expect(abb.spent).toBe(16);
    expect(abb.status).toBe("ok");
  });

  it("marks warn and over by thresholds", () => {
    const rows = [
      tx({ id: "1", date: "2026-09-01", description: "Shop", amount: -85, category: "Shopping" }),
      tx({ id: "2", date: "2026-09-02", description: "Food", amount: -120, category: "Ristoranti" }),
    ];
    const report = buildBudgetReport(rows, { Shopping: 100, Ristoranti: 100 }, now);
    expect(report.rows.find((r) => r.category === "Shopping")!.status).toBe("warn");
    expect(report.rows.find((r) => r.category === "Ristoranti")!.status).toBe("over");
  });

  it("omits categories not in budgets and ignores non-positive limits", () => {
    const report = buildBudgetReport(
      [tx({ id: "1", date: "2026-09-01", description: "X", amount: -10, category: "Spesa" })],
      { Spesa: 50, Shopping: 0, Altro: -5 },
      now,
    );
    expect(report.rows.map((r) => r.category)).toEqual(["Spesa"]);
  });

  it("exposes warn threshold constants", () => {
    expect(BUDGET_WARN_PCT).toBe(80);
    expect(BUDGET_OVER_PCT).toBe(100);
  });
});
