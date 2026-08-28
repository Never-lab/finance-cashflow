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

  it("maps insurance SDD to Assicurazioni", () => {
    expect(categorize("ADDEBITO DIRETTO CORE RCUR AVVERA S.P.A.", "Addebiti")).toBe(
      "Assicurazioni",
    );
    expect(categorize("ALLIANZ SPA TRIESTE", "Addebiti")).toBe("Assicurazioni");
  });
});
