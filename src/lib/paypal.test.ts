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
    const plan = s.plans.find((p) => p.kind === "pay_in_3");
    expect(plan?.paidCount).toBe(3);
    expect(plan?.remainingEstimate).toBe(0);
    expect(plan?.status).toBe("likely_done");
    expect(s.otherOut).toHaveLength(1);
    expect(s.remainingDebt).toBe(0);
  });

  it("estimates 1 remaining for 2 of 3 installments", () => {
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
    expect(s.plans[0]?.remainingEstimate).toBe(50);
    expect(s.remainingDebt).toBe(50);
  });
});
