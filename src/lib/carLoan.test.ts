import { describe, expect, it } from "vitest";
import { carLoanKeyFromDescription, isCarLoanTransaction } from "./carLoan";

const AVVERA =
  "Addebito Diretto Core Rcur Prg.car Avvera S.p.a. - Payment Loan N. 1076258 Installment N. 9";

describe("carLoan", () => {
  it("detects Avvera payment loan", () => {
    expect(isCarLoanTransaction({ description: AVVERA, category: "Finanziamento auto" })).toBe(
      true,
    );
    expect(carLoanKeyFromDescription(AVVERA)).toBe("avvera-1076258");
  });
});
