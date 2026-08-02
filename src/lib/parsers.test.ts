import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRevolut } from "./parseRevolut";
import { parseMediolanum, cleanMediolanumDescription } from "./parseMediolanum";
import { detectBank } from "./detectBank";

const revolutCsv = `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
Card payment,Pocket,2026-01-10 10:00:00,2026-01-10 10:01:00,Esselunga,-45.20,0,EUR,COMPLETED,1000.00
Card payment,Pocket,2026-01-11 10:00:00,2026-01-11 10:01:00,Netflix,-15.99,0,EUR,PENDING,984.01
Transfer,Pocket,2026-01-12 09:00:00,2026-01-12 09:00:00,Stipendio Acme,2000.00,0,EUR,COMPLETED,2984.01
`;

const revolutItCsv = `Tipo,Prodotto,Data di inizio,Data di completamento,Descrizione,Importo,Costo,Valuta,State,Saldo
Ricarica,Attuale,2026-05-13 17:21:14,2026-05-13 17:21:15,Pagamento da ANTINORI NICHOLAS,219.72,0,EUR,COMPLETATO,219.72
Pagamento,Attuale,2026-05-13 17:21:53,2026-05-13 17:21:53,Accredita EUR Manutenzione Auto da EUR,-80,0,EUR,COMPLETATO,139.72
Pagamento,Risparmi,2026-05-13 17:21:53,2026-05-13 17:21:53,Accredita EUR Manutenzione Auto da EUR,80,0,EUR,COMPLETATO,80
Interessi,Deposito,2026-07-15 3:47:39,2026-07-15 3:47:39,"Interessi netti pagati nel conto ""Instant Access Savings""",0.02,0,EUR,COMPLETATO,430.02
Pagamento,Attuale,2026-05-14 10:00:00,2026-05-14 10:00:00,Pending Shop,-12,0,EUR,PENDING,0
`;

const mediolanumSimple = `Data;Descrizione;Importo
15/01/2026;BONIFICO STIPENDIO ACME;2.000,00
16/01/2026;PAGAMENTO ESSSELUNGA;-54,30
`;

describe("parseRevolut", () => {
  it("keeps only COMPLETED (EN)", () => {
    const rows = parseRevolut(revolutCsv);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.description.includes("Netflix"))).toBeUndefined();
    expect(rows.find((r) => r.amount > 0)?.amount).toBe(2000);
  });

  it("parses Italian export COMPLETATO + Importo", () => {
    const rows = parseRevolut(revolutItCsv);
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.amount === 0.02)?.category).toBe("Interessi");
    expect(rows.find((r) => r.amount === 80)?.description).toContain("Risparmi");
    expect(rows.every((r) => r.source === "revolut")).toBe(true);
  });

  it("parses the user export file if present", () => {
    let text: string;
    try {
      text = readFileSync(
        "fixtures/account-statement_2025-07-29_2026-08-02_it-it_8f35eb.csv",
        "utf8",
      );
    } catch {
      return;
    }
    const rows = parseRevolut(text);
    expect(rows.length).toBeGreaterThan(10);
    expect(detectBank(text, "account-statement_x.csv")).toBe("revolut");
    expect(rows.some((r) => r.category === "Interessi")).toBe(true);
  });
});

describe("parseMediolanum", () => {
  it("parses simple semicolon IT csv", () => {
    const rows = parseMediolanum(mediolanumSimple);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.description.includes("STIPENDIO"))?.amount).toBe(2000);
  });

  it("parses real bank export with preamble + Uscite/Entrate", () => {
    const sample = readFileSync("fixtures/mediolanum-sample.csv", "utf8");
    const rows = parseMediolanum(sample);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.find((r) => r.amount === 400)?.category).toBe("Trasferimenti");
    expect(rows.find((r) => r.amount === -109.6)?.category).toBe("Mutuo");
    expect(rows.find((r) => r.description.includes("CONAD"))?.amount).toBe(-14.95);
    expect(rows.find((r) => r.amount === -450)?.category).toBe("Prelievi");
  });

  it("parses the user export file if present", () => {
    let text: string;
    try {
      text = readFileSync(
        "fixtures/Elenco movimenti dal 02-02-2026 al 02-08-2026.csv",
        "utf8",
      );
    } catch {
      return;
    }
    const rows = parseMediolanum(text);
    expect(rows.length).toBeGreaterThan(50);
    expect(rows.every((r) => r.source === "mediolanum")).toBe(true);
    expect(rows.some((r) => r.amount > 0)).toBe(true);
    expect(rows.some((r) => r.amount < 0)).toBe(true);
  });
});

describe("cleanMediolanumDescription", () => {
  it("extracts C/O merchant", () => {
    expect(
      cleanMediolanumDescription(
        "PAGAMENTI PAESI UE ... C/O DECATHLON 00002992 TERNI CARTA N. 537572******8646 - CIRCUITO",
      ),
    ).toBe("DECATHLON 00002992 TERNI");
  });
});

describe("detectBank", () => {
  it("detects from headers / filename", () => {
    expect(detectBank(revolutCsv)).toBe("revolut");
    expect(detectBank(revolutItCsv)).toBe("revolut");
    expect(detectBank(mediolanumSimple)).toBe("mediolanum");
    expect(detectBank("a,b\n1,2", "revolut-export.csv")).toBe("revolut");
    expect(
      detectBank("x", "account-statement_2025-07-29_2026-08-02_it-it.csv"),
    ).toBe("revolut");
    expect(
      detectBank("x", "Elenco movimenti dal 02-02-2026 al 02-08-2026.csv"),
    ).toBe("mediolanum");
  });
});
