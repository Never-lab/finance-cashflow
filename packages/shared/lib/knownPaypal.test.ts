import { describe, expect, it } from "vitest";
import { AUTODOC_PAYIN3, matchKnownPaypalPlan, UNIEURO_PAYMONTHLY } from "./knownPaypal";

describe("knownPaypal", () => {
  it("matches Unieuro Pay Monthly at 23.94", () => {
    expect(matchKnownPaypalPlan("pay_monthly", 23.94, UNIEURO_PAYMONTHLY)).toBe(true);
    expect(matchKnownPaypalPlan("pay_monthly", 202.64, UNIEURO_PAYMONTHLY)).toBe(false);
  });

  it("matches Autodoc full and split installments", () => {
    expect(matchKnownPaypalPlan("pay_in_3", 38.46, AUTODOC_PAYIN3)).toBe(true);
    expect(matchKnownPaypalPlan("pay_in_3", 28.13, AUTODOC_PAYIN3)).toBe(true);
    expect(matchKnownPaypalPlan("pay_in_3", 10.33, AUTODOC_PAYIN3)).toBe(true);
    expect(matchKnownPaypalPlan("pay_in_3", 146.83, AUTODOC_PAYIN3)).toBe(false);
  });
});
