import { describe, it, expect } from "vitest";
import { openDb, migrate } from "../db";
import { DEFAULT_USER_ID } from "./requestContext";
import { loadAppState, replaceAppState, mergeImportIntoDb, applyMediolanumIdDedup } from "./stateRepo";
import { transactionId } from "@shared/lib/csv";

describe("stateRepo", () => {
  it("roundtrips AppState and merges by id", () => {
    const db = openDb(":memory:");
    migrate(db);
    replaceAppState(db, DEFAULT_USER_ID, {
      transactions: [
        {
          id: "a1",
          date: "2026-01-01",
          description: "x",
          amount: -10,
          currency: "EUR",
          source: "revolut",
          category: "Altro",
        },
      ],
      categoryOverrides: { a1: "Spesa" },
      recurringMarks: {},
      internalOverrides: {},
    });
    const s = loadAppState(db, DEFAULT_USER_ID);
    expect(s.transactions).toHaveLength(1);
    expect(s.categoryOverrides.a1).toBe("Spesa");

    const r = mergeImportIntoDb(db, DEFAULT_USER_ID, [
      {
        id: "a1",
        date: "2026-01-02",
        description: "x2",
        amount: -11,
        currency: "EUR",
        source: "revolut",
        category: "Altro",
      },
      {
        id: "b2",
        date: "2026-01-03",
        description: "y",
        amount: 5,
        currency: "EUR",
        source: "mediolanum",
        category: "Entrata",
      },
    ]);
    expect(r.added).toBe(1);
    expect(r.updated).toBe(1);
    expect(loadAppState(db, DEFAULT_USER_ID).transactions.find((t) => t.id === "a1")?.amount).toBe(
      -11,
    );
  });

  it("dedupes truncated Mediolanum ids and remaps category overrides", () => {
    const db = openDb(":memory:");
    migrate(db);
    const full =
      "BONIFICO - SEPA ISTANTANEO NICHOLAS ANTINORI COOR.BENEF.: IT46 K036 6901 6005 9172 3571 990 BANCA DESTINATARIA: 03669/01600-REVOITM2XXX DATA ORDINE: 14/09/26 DATA REGOLAMENTO: 14/09/26 CRO: 73E678F5D2E749028E4736FFB0325EBD NOTE: POCKET REVOLUT";
    const trunc = full.slice(0, 100);
    const shortId = transactionId("mediolanum", "2026-09-14", -816, trunc);
    const longId = transactionId("mediolanum", "2026-09-14", -816, full);
    replaceAppState(db, DEFAULT_USER_ID, {
      transactions: [
        {
          id: shortId,
          date: "2026-09-14",
          description: trunc,
          amount: -816,
          currency: "EUR",
          source: "mediolanum",
          category: "Trasferimenti",
        },
        {
          id: longId,
          date: "2026-09-14",
          description: "Bonifico Pocket Revolut",
          amount: -816,
          currency: "EUR",
          source: "mediolanum",
          category: "Trasferimenti",
          internal: true,
        },
      ],
      categoryOverrides: { [shortId]: "Investimenti" },
      recurringMarks: {},
      internalOverrides: {},
    });

    const stats = applyMediolanumIdDedup(db, DEFAULT_USER_ID);
    expect(stats.removed).toBeGreaterThanOrEqual(1);
    const s = loadAppState(db, DEFAULT_USER_ID);
    expect(s.transactions.filter((t) => t.date === "2026-09-14" && t.amount === -816)).toHaveLength(
      1,
    );
    const kept = s.transactions[0];
    expect(kept.id).toContain("cro:73e678f5d2e749028e4736ffb0325ebd");
    expect(kept.description).toBe("Bonifico Pocket Revolut");
    expect(s.categoryOverrides[kept.id]).toBe("Investimenti");
    expect(s.categoryOverrides[shortId]).toBeUndefined();
  });
});
