import { describe, expect, it } from "vitest";
import { transactionId } from "./csv";
import {
  descriptionKeyFromTxId,
  isMediolanumTruncationPair,
  mediolanumIdKey,
  dedupeMediolanumTransactions,
} from "./mediolanumId";
import type { Transaction } from "../types";

const fullBonifico =
  "BONIFICO - SEPA ISTANTANEO NICHOLAS ANTINORI COOR.BENEF.: IT46 K036 6901 6005 9172 3571 990 BANCA DESTINATARIA: 03669/01600-REVOITM2XXX DATA ORDINE: 14/09/26 DATA REGOLAMENTO: 14/09/26 CRO: 73E678F5D2E749028E4736FFB0325EBD NOTE: POCKET REVOLUT";

const truncBonifico = fullBonifico.slice(0, 100);

const fullAvvera =
  "ADDEBITO DIRETTO CORE RCUR PRG.CAR.: 262680306029355 ITCO000001076258M001 AVVERA S.P.A. - PAYMENT LOAN N. 1076258 INSTALLMENT N. 11 DEL 01/10/2026 - BACRIT22 IT150010000002279230359";

const truncAvvera = fullAvvera.slice(0, 100);

const fullCard =
  "PAGAMENTI PAESI UE CARTA N. 000 DEL 10/09/26 VALUTA EUR PAESE FRANCIA C/O KLARNA* TICKETONE PARIS CARTA N. 537572******8646 - CIRCUITO MASTERCARD COD. MCC 5999 000011537867";

function tx(
  partial: Pick<Transaction, "id" | "date" | "amount" | "description"> &
    Partial<Transaction>,
): Transaction {
  return {
    currency: "EUR",
    source: "mediolanum",
    category: "Altro",
    ...partial,
  };
}

describe("mediolanumIdKey", () => {
  it("prefers CRO when present", () => {
    expect(mediolanumIdKey(fullBonifico)).toBe("cro:73e678f5d2e749028e4736ffb0325ebd");
  });

  it("uses SDD prg.car + mandate for AVVERA-style", () => {
    expect(mediolanumIdKey(fullAvvera)).toBe(
      "sdd:262680306029355:itco000001076258m001",
    );
    expect(mediolanumIdKey(truncAvvera)).toBe(
      "sdd:262680306029355:itco000001076258m001",
    );
  });

  it("same id for truncated vs full AVVERA", () => {
    const a = transactionId("mediolanum", "2026-10-01", -314.5, mediolanumIdKey(truncAvvera));
    const b = transactionId("mediolanum", "2026-10-01", -314.5, mediolanumIdKey(fullAvvera));
    expect(a).toBe(b);
  });

  it("uses card purchase date + merchant", () => {
    expect(mediolanumIdKey(fullCard)).toBe("card:10/09/26:klarna* ticketone paris");
  });

  it("is stable when already a key", () => {
    expect(mediolanumIdKey("cro:abc123")).toBe("cro:abc123");
    expect(mediolanumIdKey("sdd:1:itcox")).toBe("sdd:1:itcox");
  });
});

describe("isMediolanumTruncationPair", () => {
  it("detects 100-char prefix truncation", () => {
    expect(isMediolanumTruncationPair(truncBonifico.toLowerCase(), fullBonifico.toLowerCase())).toBe(
      true,
    );
  });

  it("detects short card summary vs full causale", () => {
    expect(isMediolanumTruncationPair("pagamenti paesi ue", fullCard.toLowerCase())).toBe(true);
  });

  it("does not merge two different card merchants same length", () => {
    const a =
      "pagamenti paesi ue carta n. 000 del 17/07/26 valuta eur paese italia c/o caffe firenze srl terni carta n. 537572******8646";
    const b =
      "pagamenti paesi ue carta n. 000 del 17/07/26 valuta eur paese italia c/o bogart locale ternano terni carta n. 537572******8646";
    expect(isMediolanumTruncationPair(a, b)).toBe(false);
  });
});

describe("dedupeMediolanumTransactions", () => {
  it("prefers cleaned merchant over truncated causale stub", () => {
    const shortId = transactionId("mediolanum", "2026-09-14", -23.07, "pagamenti paesi ue");
    const longId = transactionId("mediolanum", "2026-09-14", -23.07, fullCard);
    const result = dedupeMediolanumTransactions([
      tx({
        id: shortId,
        date: "2026-09-14",
        amount: -23.07,
        description: "Pagamenti paesi UE",
      }),
      tx({
        id: longId,
        date: "2026-09-14",
        amount: -23.07,
        description: "KLARNA* TICKETONE PARIS",
        category: "Abbonamenti",
      }),
    ]);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe("KLARNA* TICKETONE PARIS");
  });

  it("collapses truncation dup and rekeys to CRO", () => {
    const shortId = transactionId("mediolanum", "2026-09-14", -816, truncBonifico);
    const longId = transactionId("mediolanum", "2026-09-14", -816, fullBonifico);
    const result = dedupeMediolanumTransactions([
      tx({
        id: shortId,
        date: "2026-09-14",
        amount: -816,
        description: truncBonifico.slice(0, 100),
        internal: false,
      }),
      tx({
        id: longId,
        date: "2026-09-14",
        amount: -816,
        description: "Bonifico Pocket Revolut",
        internal: true,
        category: "Trasferimenti",
      }),
    ]);
    expect(result.transactions).toHaveLength(1);
    const kept = result.transactions[0];
    expect(kept.id).toBe(
      transactionId("mediolanum", "2026-09-14", -816, "cro:73e678f5d2e749028e4736ffb0325ebd"),
    );
    expect(kept.description).toBe("Bonifico Pocket Revolut");
    expect(kept.internal).toBe(true);
    expect(result.remapped[shortId]).toBe(kept.id);
    expect(result.remapped[longId]).toBe(kept.id);
  });

  it("leaves unrelated sources alone", () => {
    const r = dedupeMediolanumTransactions([
      tx({
        id: "revolut|x",
        date: "2026-01-01",
        amount: -1,
        description: "x",
        source: "revolut",
      }),
    ]);
    expect(r.transactions).toHaveLength(1);
    expect(r.transactions[0].id).toBe("revolut|x");
  });
});

describe("descriptionKeyFromTxId", () => {
  it("extracts raw after amount", () => {
    const id = transactionId("mediolanum", "2026-10-01", -314.5, "hello|world");
    expect(descriptionKeyFromTxId(id)).toBe("hello|world");
  });
});
