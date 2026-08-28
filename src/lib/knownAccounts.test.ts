import { describe, expect, it } from "vitest";
import { detectInternal } from "./internal";
import { isEmergencyFundTransfer, matchKnownAccount, sumEmergencyFundOutflows } from "./knownAccounts";

describe("knownAccounts", () => {
  const raw =
    "BONIFICO - SEPA ISTANTANEO NICHOLAS ANTINORI COOR.BENEF.: IT02 J030 6234 2100 0006 0114 212";

  it("matches emergency fund IBAN in raw text", () => {
    expect(matchKnownAccount(raw)?.id).toBe("mediolanum-emergency-deposit");
  });

  it("marks bonifico to deposit as internal", () => {
    expect(
      detectInternal({
        source: "mediolanum",
        description: "Fondo emergenza Mediolanum",
        rawDescription: raw,
        tipologia: "Bonifici",
      }),
    ).toBe(true);
  });

  it("sums outflows in period", () => {
    const total = sumEmergencyFundOutflows([
      { description: "Fondo emergenza Mediolanum", amount: -150 },
      { description: "Esselunga", amount: -40 },
    ]);
    expect(total).toBe(150);
    expect(isEmergencyFundTransfer({ description: "Fondo emergenza Mediolanum" })).toBe(true);
  });
});
