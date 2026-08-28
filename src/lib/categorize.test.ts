import { describe, expect, it } from "vitest";
import { categorize } from "./categorize";

describe("categorize", () => {
  it("maps card POS under tipologia prelievi to Shopping", () => {
    expect(categorize("PAGAMENTI PAESI UE C/O NEGOZIO", "Prelievi - Pagamenti")).toBe(
      "Shopping",
    );
  });

  it("maps cash ATM to Prelievi", () => {
    expect(categorize("PRELIEVO DI CONTANTE ATM", "Carte")).toBe("Prelievi");
    expect(categorize("PRELIEVO DI CONTANTE ATM MAXIPRELIEVO", "Prelievi - Pagamenti")).toBe(
      "Prelievi",
    );
  });

  it("maps insurance and car finance SDD", () => {
    expect(
      categorize(
        "Addebito Diretto Core Rcur Prg.car Avvera S.p.a. - Payment Loan N. 1076258 Installment N. 9",
        "Addebiti",
      ),
    ).toBe("Finanziamento auto");
    expect(categorize("ALLIANZ SPA TRIESTE", "Addebiti")).toBe("Assicurazioni");
  });
});
