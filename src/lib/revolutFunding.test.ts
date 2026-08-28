import { describe, expect, it } from "vitest";
import { isMediolanumRevolutFunding, isRevolutBankTopUp } from "./revolutFunding";

describe("revolutFunding", () => {
  it("detects Mediolanum bonifico verso Pocket Revolut", () => {
    expect(
      isMediolanumRevolutFunding({
        source: "mediolanum",
        description: "Bonifico Pocket Revolut",
        rawDescription: "BONIFICO SEPA REVOITM2XXX NOTE: POCKET REVOLUT",
      }),
    ).toBe(true);
  });

  it("detects Revolut incoming salary top-up", () => {
    expect(
      isRevolutBankTopUp({
        source: "revolut",
        description: "Pagamento da NICHOLAS ANTINORI",
        rawDescription: "Pagamento da NICHOLAS ANTINORI",
        tipologia: "Ricarica",
      }),
    ).toBe(true);
  });
});
