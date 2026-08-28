import { describe, expect, it } from "vitest";
import { defaultLoanTargets, mergeLoanTargets, SELFYCREDIT_00136196 } from "./knownLoans";

describe("knownLoans", () => {
  it("includes Selfycredit contract defaults", () => {
    const t = defaultLoanTargets()[SELFYCREDIT_00136196.key];
    expect(t?.label).toBe("Selfycredit Instant");
    expect(t?.totalInstallments).toBe(36);
    expect(t?.principalAmount).toBe(3500);
    expect(t?.endDate).toBe("2028-11-30");
    expect(t?.remainingDebt).toBe(2792.4);
    expect(t?.totalRepaid).toBe(707.6);
    expect(t?.nextPaymentDate).toBe("2026-08-31");
  });

  it("merges stored overrides over defaults", () => {
    const merged = mergeLoanTargets({
      [SELFYCREDIT_00136196.key]: { totalInstallments: 30 },
    });
    expect(merged[SELFYCREDIT_00136196.key]?.totalInstallments).toBe(30);
    expect(merged[SELFYCREDIT_00136196.key]?.label).toBe("Selfycredit Instant");
  });
});
