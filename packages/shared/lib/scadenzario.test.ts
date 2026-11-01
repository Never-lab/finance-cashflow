import { describe, expect, it } from "vitest";
import { buildScadenzario } from "./scadenzario";
import type { Transaction } from "../types";

function tx(
  partial: Partial<Transaction> &
    Pick<Transaction, "id" | "date" | "description" | "amount">,
): Transaction {
  return {
    currency: "EUR",
    source: "mediolanum",
    category: "Altro",
    internal: false,
    ...partial,
  };
}

const MUTUO_DESC =
  "PAG. MUTUO/FIN. VARI NUM. 740/00136196 R.008 06740001361960000000000 D";

describe("buildScadenzario", () => {
  const now = new Date("2026-11-01T12:00:00Z");

  it("collects loan, subscription, vault; sorts by dueDate; filters horizon", () => {
    const rows: Transaction[] = [
      tx({
        id: "m1",
        date: "2026-09-30",
        description: MUTUO_DESC,
        amount: -109.6,
        category: "Mutuo",
      }),
      tx({
        id: "m2",
        date: "2026-10-31",
        description: MUTUO_DESC,
        amount: -109.6,
        category: "Mutuo",
      }),
      tx({
        id: "n1",
        date: "2026-09-15",
        description: "NETFLIX.COM",
        amount: -15.99,
        category: "Abbonamenti",
      }),
      tx({
        id: "n2",
        date: "2026-10-15",
        description: "NETFLIX.COM",
        amount: -15.99,
        category: "Abbonamenti",
      }),
      // far loan installment — next due rolls past horizon if extinguished remaining 0
      tx({
        id: "done1",
        date: "2026-01-15",
        description: "PAG. MUTUO/FIN. VARI NUM. 999/00000001 X",
        amount: -50,
        category: "Mutuo",
      }),
      tx({
        id: "done2",
        date: "2026-02-15",
        description: "PAG. MUTUO/FIN. VARI NUM. 999/00000001 X",
        amount: -50,
        category: "Mutuo",
      }),
    ];

    const { items, totalDue, monthBurden } = buildScadenzario({
      transactions: rows,
      loanTargets: {
        "mutuo-740/00136196": {
          label: "Selfycredit",
          totalInstallments: 36,
          remainingDebt: 2000,
          nextPaymentDate: "2026-11-30",
        },
        "mutuo-999/00000001": {
          totalInstallments: 2,
          remainingDebt: 0,
        },
      },
      now,
      horizonDays: 60,
    });

    const kinds = items.map((i) => i.kind);
    expect(kinds).toContain("loan");
    expect(kinds).toContain("subscription");
    expect(kinds).toContain("vault");
    expect(kinds).not.toContain("paypal");

    // extinguished loan skipped
    expect(items.find((i) => i.id.includes("999"))).toBeUndefined();

    // sorted ascending
    for (let i = 1; i < items.length; i++) {
      expect(items[i]!.dueDate >= items[i - 1]!.dueDate).toBe(true);
    }

    // vault Auto deadline 2026-11-30 within horizon
    const vault = items.find((i) => i.kind === "vault");
    expect(vault?.dueDate).toBe("2026-11-30");
    expect(vault?.sourceTab).toBe("piano");
    expect(vault?.amount).toBeGreaterThanOrEqual(0);

    const loan = items.find((i) => i.kind === "loan");
    expect(loan?.dueDate).toBe("2026-11-30");
    expect(loan?.amount).toBe(109.6);
    expect(loan?.sourceTab).toBe("mutui");

    const sub = items.find((i) => i.kind === "subscription");
    expect(sub).toBeDefined();
    expect(sub!.sourceTab).toBe("abbonamenti");
    expect(sub!.amount).toBeGreaterThan(0);
    expect(sub!.dueDate >= "2026-11-01" && sub!.dueDate <= "2026-12-31").toBe(true);

    const payableSum = (list: typeof items) =>
      Math.round(
        list
          .filter((i) => i.kind !== "vault")
          .reduce((s, i) => s + (i.amount ?? 0), 0) * 100,
      ) / 100;
    expect(totalDue).toBe(payableSum(items));

    const novSum = payableSum(items.filter((i) => i.dueDate.startsWith("2026-11")));
    expect(monthBurden).toBe(novSum);
  });

  it("skips cancelled subscriptions and past/far dues", () => {
    const rows = [
      tx({
        id: "s1",
        date: "2026-09-01",
        description: "SPOTIFY AB",
        amount: -9.99,
        category: "Abbonamenti",
      }),
      tx({
        id: "s2",
        date: "2026-10-01",
        description: "SPOTIFY AB",
        amount: -9.99,
        category: "Abbonamenti",
      }),
    ];

    const cancelled = buildScadenzario({
      transactions: rows,
      recurringMarks: { "spotify ab": "cancelled" },
      now,
      horizonDays: 60,
    });
    expect(cancelled.items.filter((i) => i.kind === "subscription")).toHaveLength(0);

    const far = buildScadenzario({
      transactions: rows,
      now,
      horizonDays: 5,
    });
    // nextDue from Oct 1 + ~30d ≈ Oct 31 — may be before today Nov 1 → rolled forward;
    // with tiny horizon only items due by Nov 6
    for (const i of far.items) {
      expect(i.dueDate <= "2026-11-06").toBe(true);
      expect(i.dueDate >= "2026-11-01").toBe(true);
    }
  });

  it("includes active paypal plans in horizon", () => {
    const rows = [
      tx({
        id: "p1",
        date: "2026-09-20",
        description: "PAYPAL *PAGA IN 3 MERCHANT",
        amount: -40,
        category: "Shopping",
      }),
      tx({
        id: "p2",
        date: "2026-10-20",
        description: "PAYPAL *PAGA IN 3 MERCHANT",
        amount: -40,
        category: "Shopping",
      }),
    ];

    const { items } = buildScadenzario({
      transactions: rows,
      now,
      horizonDays: 60,
    });

    const pp = items.filter((i) => i.kind === "paypal");
    expect(pp.length).toBeGreaterThanOrEqual(1);
    expect(pp[0]!.amount).toBe(40);
    expect(pp[0]!.sourceTab).toBe("paypal");
    expect(pp[0]!.dueDate >= "2026-11-01").toBe(true);
  });
});
