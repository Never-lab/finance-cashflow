import { describe, expect, it } from "vitest";
import {
  buildLoanSummary,
  isLoanTransaction,
  loanKeyFromDescription,
} from "./loans";
import { defaultLoanTargets } from "./knownLoans";
import type { Transaction } from "../types";

function tx(
  partial: Partial<Transaction> &
    Pick<Transaction, "id" | "date" | "description" | "amount">,
): Transaction {
  return {
    currency: "EUR",
    source: "mediolanum",
    category: "Mutuo",
    internal: false,
    ...partial,
  };
}

const MUTUO_DESC =
  "PAG. MUTUO/FIN. VARI NUM. 740/00136196 R.008 06740001361960000000000 D";

describe("loans", () => {
  it("extracts contract ref from Mediolanum mutuo line", () => {
    expect(loanKeyFromDescription(MUTUO_DESC)).toBe("mutuo-740/00136196");
    expect(isLoanTransaction(tx({ id: "1", date: "2026-07-31", description: MUTUO_DESC, amount: -109.6 }))).toBe(
      true,
    );
  });

  it("groups installments and estimates remaining when total is known", () => {
    const rows = [
      tx({ id: "m1", date: "2025-12-31", description: MUTUO_DESC, amount: -109.6 }),
      tx({ id: "m2", date: "2026-01-31", description: MUTUO_DESC, amount: -109.6 }),
      tx({ id: "m3", date: "2026-02-28", description: MUTUO_DESC, amount: -109.6 }),
      tx({ id: "m4", date: "2026-03-31", description: MUTUO_DESC, amount: -109.6 }),
      tx({ id: "m5", date: "2026-04-30", description: MUTUO_DESC, amount: -109.6 }),
      tx({ id: "m6", date: "2026-05-31", description: MUTUO_DESC, amount: -109.6 }),
      tx({ id: "m7", date: "2026-06-30", description: MUTUO_DESC, amount: -109.6 }),
      tx({ id: "m8", date: "2026-07-31", description: MUTUO_DESC, amount: -109.6 }),
    ];

    const s = buildLoanSummary(rows, {
      "mutuo-740/00136196": {
        label: "Selfycredit Instant",
        totalInstallments: 36,
        principalAmount: 3500,
        endDate: "2028-11-30",
        remainingDebt: 2792.4,
        totalRepaid: 707.6,
        nextPaymentDate: "2026-08-31",
      },
    });
    expect(s.plans).toHaveLength(1);
    const plan = s.plans[0]!;
    expect(plan.label).toBe("Selfycredit Instant");
    expect(plan.paidCount).toBe(8);
    expect(plan.installmentAmount).toBe(109.6);
    expect(plan.remainingInstallments).toBe(28);
    expect(plan.remainingEstimate).toBe(2792.4);
    expect(plan.remainingSource).toBe("bank");
    expect(plan.totalRepaidBank).toBe(707.6);
    expect(plan.nextPaymentDate).toBe("2026-08-31");
    expect(s.remainingDebt).toBe(2792.4);
    expect(s.monthlyBurden).toBe(109.6);
  });

  it("leaves remaining null without target", () => {
    const rows = [
      tx({ id: "1", date: "2026-06-30", description: MUTUO_DESC, amount: -109.6 }),
      tx({ id: "2", date: "2026-07-31", description: MUTUO_DESC, amount: -109.6 }),
    ];
    const s = buildLoanSummary(rows);
    expect(s.plans[0]?.remainingEstimate).toBeNull();
    expect(s.plans[0]?.remainingSource).toBeNull();
    expect(s.remainingDebt).toBe(0);
  });

  it("falls back to installment estimate without bank debt", () => {
    const rows = [
      tx({ id: "1", date: "2026-06-30", description: MUTUO_DESC, amount: -109.6 }),
      tx({ id: "2", date: "2026-07-31", description: MUTUO_DESC, amount: -109.6 }),
    ];
    const s = buildLoanSummary(rows, { "mutuo-740/00136196": { totalInstallments: 36 } });
    expect(s.plans[0]?.remainingEstimate).toBe(3726.4);
    expect(s.plans[0]?.remainingSource).toBe("estimate");
  });

  it("groups Avvera car loan by contract number", () => {
    const avvera =
      "Addebito Diretto Core Rcur Prg.car Avvera S.p.a. - Payment Loan N. 1076258 Installment N. 9";
    const rows = [
      tx({
        id: "a1",
        date: "2026-07-01",
        description: avvera,
        amount: -320,
        category: "Finanziamento auto",
      }),
      tx({
        id: "a2",
        date: "2026-08-01",
        description: avvera,
        amount: -320,
        category: "Finanziamento auto",
      }),
    ];
    const s = buildLoanSummary(rows, defaultLoanTargets());
    expect(s.plans[0]?.key).toBe("avvera-1076258");
    expect(s.plans[0]?.label).toBe("Finanziamento auto Avvera");
    expect(s.plans[0]?.remainingEstimate).toBe(23096.19);
    expect(s.plans[0]?.remainingSource).toBe("bank");
    expect(s.plans[0]?.principalAmount).toBe(24109);
  });
});
