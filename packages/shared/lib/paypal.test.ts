import { describe, expect, it } from "vitest";
import { buildPaypalSummary, classifyPaypal, isPaypalTransaction } from "./paypal";
import type { Transaction } from "../types";

function tx(
  partial: Partial<Transaction> &
    Pick<Transaction, "id" | "date" | "description" | "amount">,
): Transaction {
  return {
    currency: "EUR",
    source: "mediolanum",
    category: "Shopping",
    internal: false,
    ...partial,
  };
}

describe("paypal", () => {
  it("detects and classifies", () => {
    expect(
      isPaypalTransaction(
        tx({
          id: "1",
          date: "2026-07-01",
          description: "PAYPAL *PAGA IN 3 RATE",
          amount: -146.83,
        }),
      ),
    ).toBe(true);
    expect(
      classifyPaypal(
        tx({
          id: "1",
          date: "2026-07-01",
          description: "PAYPAL *PYPL PAYMTHLY",
          amount: -23.94,
        }),
      ),
    ).toBe("pay_monthly");
  });

  it("empty CSV → remainingDebt 0, monthlyBurden 0, no phantom known plans", () => {
    const s = buildPaypalSummary([]);
    expect(s.remainingDebt).toBe(0);
    expect(s.monthlyBurden).toBe(0);
    expect(s.plans.filter((p) => p.key.startsWith("paypal-"))).toHaveLength(0);
  });

  it("groups paga in 3 and estimates remaining", () => {
    const rows = [
      tx({
        id: "a",
        date: "2026-05-27",
        description: "PAYPAL *PAGA IN 3 RATE",
        amount: -146.83,
      }),
      tx({
        id: "b",
        date: "2026-06-27",
        description: "PAYPAL *PAGA IN 3 RATE",
        amount: -146.83,
      }),
      tx({
        id: "c",
        date: "2026-07-26",
        description: "PAYPAL *PAGA IN 3 RATE",
        amount: -146.83,
      }),
      tx({
        id: "d",
        date: "2026-07-10",
        description: "PAYPAL *Something Else Shop",
        amount: -12,
      }),
    ];
    const s = buildPaypalSummary(rows);
    const plan = s.plans.find((p) => p.key === "pay_in_3|146.83");
    expect(plan?.paidCount).toBe(3);
    expect(plan?.remainingEstimate).toBe(0);
    expect(plan?.status).toBe("likely_done");
    expect(s.otherOut).toHaveLength(1);
    expect(s.remainingDebt).toBe(0);
    expect(s.monthlyBurden).toBe(0);
  });

  it("matched closed known plans → remainingDebt 0, monthlyBurden 0", () => {
    const rows = [
      tx({
        id: "u1",
        date: "2026-08-04",
        description: "PAYPAL *PYPL PAYMTHLY",
        amount: -23.94,
      }),
      tx({
        id: "a1",
        date: "2026-07-17",
        description: "PAYPAL *PAGA IN 3 RATE",
        amount: -28.13,
      }),
      tx({
        id: "a2",
        date: "2026-07-17",
        description: "PAYPAL *PAGA IN 3 RATE",
        amount: -10.33,
      }),
      tx({
        id: "a3",
        date: "2026-08-16",
        description: "PAYPAL *PAGA IN 3 RATE",
        amount: -38.46,
      }),
    ];
    const s = buildPaypalSummary(rows);
    const unieuro = s.plans.find((p) => p.key === "paypal-unieuro");
    const autodoc = s.plans.find((p) => p.key === "paypal-autodoc");
    expect(unieuro?.merchantLabel).toBe("Unieuro S.p.A.");
    expect(unieuro?.paidCount).toBe(24);
    expect(unieuro?.remainingEstimate).toBe(0);
    expect(unieuro?.status).toBe("likely_done");
    expect(unieuro?.nextPaymentDate).toBeNull();
    expect(autodoc?.merchantLabel).toBe("Autodoc SE");
    expect(autodoc?.paidCount).toBe(3);
    expect(autodoc?.remainingEstimate).toBe(0);
    expect(autodoc?.status).toBe("likely_done");
    expect(autodoc?.nextPaymentDate).toBeNull();
    expect(s.remainingDebt).toBe(0);
    expect(s.monthlyBurden).toBe(0);
  });

  it("estimates 1 remaining for 2 of 3 installments; KPI ignores generic buckets", () => {
    const rows = [
      tx({
        id: "a",
        date: "2026-06-01",
        description: "PAYPAL *PAGA IN 3 RATE",
        amount: -50,
      }),
      tx({
        id: "b",
        date: "2026-07-01",
        description: "PAYPAL *PAGA IN 3 RATE",
        amount: -50,
      }),
    ];
    const s = buildPaypalSummary(rows);
    const plan = s.plans.find((p) => p.key === "pay_in_3|50.00");
    expect(plan?.remainingEstimate).toBe(50);
    expect(s.remainingDebt).toBe(0);
    expect(s.monthlyBurden).toBe(0);
  });

  it("overrides merge into known plan (reopen debt)", () => {
    const rows = [
      tx({
        id: "u1",
        date: "2026-08-04",
        description: "PAYPAL *PYPL PAYMTHLY",
        amount: -23.94,
      }),
    ];
    const s = buildPaypalSummary(rows, {
      "paypal-unieuro": { remainingDebt: 100, paidCount: 9 },
    });
    const unieuro = s.plans.find((p) => p.key === "paypal-unieuro");
    expect(unieuro?.status).toBe("active");
    expect(unieuro?.remainingEstimate).toBe(100);
    expect(unieuro?.paidCount).toBe(9);
    expect(s.remainingDebt).toBe(100);
    expect(s.monthlyBurden).toBe(23.94);
  });

  it("override remainingDebt 0 → likely_done", () => {
    const rows = [
      tx({
        id: "u1",
        date: "2026-08-04",
        description: "PAYPAL *PYPL PAYMTHLY",
        amount: -23.94,
      }),
    ];
    // Force active via override, then extinguish
    const open = buildPaypalSummary(rows, {
      "paypal-unieuro": { remainingDebt: 50, paidCount: 20 },
    });
    expect(open.plans.find((p) => p.key === "paypal-unieuro")?.status).toBe("active");
    const closed = buildPaypalSummary(rows, {
      "paypal-unieuro": { remainingDebt: 0 },
    });
    const unieuro = closed.plans.find((p) => p.key === "paypal-unieuro");
    expect(unieuro?.status).toBe("likely_done");
    expect(unieuro?.remainingEstimate).toBe(0);
    expect(closed.remainingDebt).toBe(0);
    expect(closed.monthlyBurden).toBe(0);
  });
});
