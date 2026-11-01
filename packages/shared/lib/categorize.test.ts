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

  it("maps fuel stations to Trasporti", () => {
    expect(categorize("C/O ENILIVE", "Prelievi - Pagamenti")).toBe("Trasporti");
    expect(categorize("C/O IS TERNI", "Prelievi - Pagamenti")).toBe("Trasporti");
  });

  it("maps Terni hospitality venues to Ristoranti", () => {
    expect(categorize("OLD WILD WEST TERNI", "Prelievi - Pagamenti")).toBe("Ristoranti");
    expect(categorize("OFFICINA 41 TERNI (BAR)", "Prelievi - Pagamenti")).toBe("Ristoranti");
    expect(categorize("POSCARGANO DAL1890 TERNI (BAR)", "Prelievi - Pagamenti")).toBe(
      "Ristoranti",
    );
    expect(categorize("BAR LUME TERNI (BAR)", "Prelievi - Pagamenti")).toBe("Ristoranti");
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

  it("maps expanded categories from real merchants", () => {
    expect(categorize("Headout · Risparmi")).toBe("Vacanze");
    expect(categorize("Five Guys · Risparmi")).toBe("Vacanze");
    expect(categorize("Lefties · Risparmi")).toBe("Vacanze");
    expect(categorize("Dia · Risparmi")).toBe("Vacanze");
    expect(categorize("Uber · Risparmi")).toBe("Vacanze");
    expect(categorize("gomining.com")).toBe("Investimenti");
    expect(categorize("Casa BALDO · Risparmi")).toBe("Vacanze");
    expect(categorize("BOLLETTINI POSTALI BOLLETTINO 896")).toBe("Regali e donazioni");
    expect(categorize("IMPOSTA DI BOLLO DOSSIER TITOLI")).toBe("Investimenti");
    expect(categorize("PAGAMENTO UTENZA PAGAMENTI SU RETE C-BILL")).toBe("Bollette");
    expect(categorize("Magazzini Gabrielli SP A.")).toBe("Casa");
    expect(categorize("Club Avolta · Risparmi")).toBe("Vacanze");
    expect(categorize("La Tasqueta Valencia · Risparmi")).toBe("Vacanze");
    expect(categorize("Bioparc Valencia · Risparmi")).toBe("Vacanze");
  });

  it("maps fixture merchants that previously fell to Altro/Shopping", () => {
    expect(categorize("SOTTOSCRIZIONE SICAV EURIZON FUND EURIZON EASYFUND-CASH")).toBe(
      "Investimenti",
    );
    expect(categorize("RIMBORSO SICAV EURIZON FUND EURIZON EQ WORLD SMAR")).toBe(
      "Investimenti",
    );
    expect(categorize("COMMISSIONI PAGAMENTI PAESI NON UE", "Prelievi - Pagamenti")).toBe(
      "Banca e commissioni",
    );
    expect(categorize("TODIS SUPERMERCATO TOD TERNI", "Prelievi - Pagamenti")).toBe("Spesa");
    expect(categorize("390501 SUPERCONTI TERN TERNI", "Prelievi - Pagamenti")).toBe("Spesa");
    expect(categorize("ACQUA E SAPONE TERNI", "Prelievi - Pagamenti")).toBe("Casa");
    expect(categorize("TIGOTA' TERNI", "Prelievi - Pagamenti")).toBe("Casa");
    expect(categorize("GELATOMANIA TERNI", "Prelievi - Pagamenti")).toBe("Ristoranti");
    expect(categorize("BOGART LOCALE TERNANO TERNI", "Prelievi - Pagamenti")).toBe(
      "Ristoranti",
    );
    expect(categorize("PIZZERIE BRUNETTI SRL TERNI", "Prelievi - Pagamenti")).toBe(
      "Ristoranti",
    );
    expect(categorize("FORNO SPADA PIZZA PALA TERNI", "Prelievi - Pagamenti")).toBe(
      "Ristoranti",
    );
    expect(categorize("PASTICCERIA BELLAVITA TERNI", "Prelievi - Pagamenti")).toBe(
      "Ristoranti",
    );
    expect(categorize("Terrazza Forti")).toBe("Ristoranti");
    expect(categorize("AMZN MKTP IT*VR9FL1CA5 LUXEMBOURG", "Prelievi - Pagamenti")).toBe(
      "Shopping",
    );
    expect(categorize("TIGER ITALIA 1 SRL TERNI", "Prelievi - Pagamenti")).toBe("Shopping");
    expect(categorize("ANTHROPIC* CLAUDE SUB SAN FRANCISCO", "Prelievi - Pagamenti")).toBe(
      "Abbonamenti",
    );
    expect(categorize("CLAUDE.AI SUBSCRIPTION SAN FRANCISCO", "Prelievi - Pagamenti")).toBe(
      "Abbonamenti",
    );
    expect(categorize("GOOGLE *YOUTUBE MEMBER LONDON", "Prelievi - Pagamenti")).toBe(
      "Abbonamenti",
    );
    expect(categorize("CLOUDFLARE SAN FRANCISCO", "Prelievi - Pagamenti")).toBe(
      "Abbonamenti",
    );
    expect(categorize("GOOGLE PLAY APPS DUBLIN", "Prelievi - Pagamenti")).toBe(
      "Abbonamenti",
    );
    expect(categorize("VERY - RICARICA MILANO", "Prelievi - Pagamenti")).toBe("Bollette");
    expect(categorize("MONDADORI BOOKSTORE TE TERNI", "Prelievi - Pagamenti")).toBe(
      "Educazione",
    );
    expect(categorize("FITNESS TERNI SSD ARL TERNI", "Prelievi - Pagamenti")).toBe(
      "Sport e palestra",
    );
    expect(categorize("BARBER SHOP DI F.N. TERNI", "Prelievi - Pagamenti")).toBe("Bellezza");
    expect(categorize("T.PETROL SRL ROMA", "Prelievi - Pagamenti")).toBe("Trasporti");
    expect(categorize("ENI16575 SANTA MARIA I", "Prelievi - Pagamenti")).toBe("Trasporti");
    expect(categorize("APP BREASY TORINO", "Prelievi - Pagamenti")).toBe("Trasporti");
    expect(categorize("MECCANICO REVISIONI TERNI", "Prelievi - Pagamenti")).toBe(
      "Auto e manutenzione",
    );
    expect(categorize("AMBROSI AUTO SPA TERNI", "Prelievi - Pagamenti")).toBe(
      "Auto e manutenzione",
    );
    expect(categorize("PRMARK CHIETI CHIETI", "Prelievi - Pagamenti")).toBe("Abbigliamento");
    expect(categorize("From Instant Access Savings · Risparmi")).toBe("Trasferimenti");
  });
});
