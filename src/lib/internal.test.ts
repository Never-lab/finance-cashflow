import { describe, expect, it } from "vitest";
import { detectInternal, resolveInternal, forCashflow } from "./internal";
import type { Transaction } from "../types";

describe("detectInternal", () => {
  it("marks Revolut pocket / deposit moves, not interest", () => {
    expect(
      detectInternal({
        source: "revolut",
        description: "Accredita EUR Fondo · Risparmi",
        rawDescription: "Accredita EUR Fondo",
        product: "Risparmi",
      }),
    ).toBe(true);
    expect(
      detectInternal({
        source: "revolut",
        description: "Interessi netti · Deposito",
        rawDescription: "Interessi netti pagati",
        tipologia: "Interessi",
        product: "Deposito",
      }),
    ).toBe(false);
  });

  it("marks Mediolanum prepaid top-up and Revolut funding, not fees", () => {
    expect(
      detectInternal({
        source: "mediolanum",
        description: "Ricarica carta prepagata",
        rawDescription: "RICARICA/RIMBORSO CARTA/E PREPAGATA/E 5226",
        tipologia: "Ricariche",
      }),
    ).toBe(true);
    expect(
      detectInternal({
        source: "mediolanum",
        description: "Commissione ricarica prepagata",
        rawDescription: "COMMISSIONE EMISSIONE/RICARICA CARTA/E PREPAGATA/E",
        tipologia: "Ricariche",
      }),
    ).toBe(false);
    expect(
      detectInternal({
        source: "mediolanum",
        description: "Bonifico Pocket Revolut",
        rawDescription: "BONIFICO ... REVOITM2XXX NOTE: POCKET REVOLUT",
      }),
    ).toBe(true);
  });

  it("marks bonifici verso conto deposito fondo emergenza (IBAN)", () => {
    expect(
      detectInternal({
        source: "mediolanum",
        description: "Fondo emergenza Mediolanum",
        rawDescription:
          "BONIFICO SEPA IT02J0306234210000060114212 NICHOLAS ANTINORI",
      }),
    ).toBe(true);
  });
});

describe("resolveInternal", () => {
  it("override wins over stale persisted flag", () => {
    const t: Transaction = {
      id: "1",
      date: "2026-08-01",
      description: "Esselunga",
      amount: -10,
      currency: "EUR",
      source: "revolut",
      category: "Spesa",
      internal: true,
    };
    expect(resolveInternal(t, {})).toBe(false);
    expect(resolveInternal(t, { "1": true })).toBe(true);
  });
});

describe("forCashflow", () => {
  it("drops internal rows", () => {
    const txns: Transaction[] = [
      {
        id: "1",
        date: "2026-08-01",
        description: "Esselunga",
        amount: -10,
        currency: "EUR",
        source: "revolut",
        category: "Spesa",
        internal: false,
      },
      {
        id: "2",
        date: "2026-08-01",
        description: "Pocket",
        amount: -100,
        currency: "EUR",
        source: "mediolanum",
        category: "Trasferimenti",
        internal: true,
      },
    ];
    expect(forCashflow(txns)).toHaveLength(1);
  });
});
