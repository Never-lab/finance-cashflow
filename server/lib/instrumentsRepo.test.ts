import { describe, it, expect } from "vitest";
import { openDb, migrate } from "../db";
import { DEFAULT_USER_ID } from "./requestContext";
import {
  upsertInstrument,
  upsertHolding,
  getHolding,
  addContribution,
  deleteContribution,
  listContributions,
  listInstruments,
  deleteInstrument,
  linkTransaction,
} from "./instrumentsRepo";

describe("instrumentsRepo", () => {
  it("recalcs cost_basis from contributions", () => {
    const db = openDb(":memory:");
    migrate(db);
    const id = "inst1";
    upsertInstrument(db, DEFAULT_USER_ID, {
      id,
      name: "VWCE",
      type: "etf",
      ticker: "VWCE.DE",
      isin: null,
      currency: "EUR",
      notes: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    upsertHolding(db, DEFAULT_USER_ID, {
      instrumentId: id,
      quantity: 10,
      cashBalance: null,
      costBasis: 0,
      asOf: "2026-01-01",
    });
    addContribution(db, DEFAULT_USER_ID, {
      id: "c1",
      instrumentId: id,
      date: "2026-01-01",
      amount: 500,
      transactionId: null,
      note: null,
    });
    expect(getHolding(db, DEFAULT_USER_ID, id)?.costBasis).toBe(500);
  });

  it("sums multiple contributions and keeps manual value when none remain", () => {
    const db = openDb(":memory:");
    migrate(db);
    const id = "inst1";
    upsertInstrument(db, DEFAULT_USER_ID, {
      id,
      name: "VWCE",
      type: "etf",
      ticker: null,
      isin: null,
      currency: "EUR",
      notes: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    upsertHolding(db, DEFAULT_USER_ID, {
      instrumentId: id,
      quantity: 10,
      cashBalance: null,
      costBasis: 42,
      asOf: "2026-01-01",
    });
    addContribution(db, DEFAULT_USER_ID, {
      id: "c1",
      instrumentId: id,
      date: "2026-01-01",
      amount: 500,
      transactionId: null,
      note: null,
    });
    addContribution(db, DEFAULT_USER_ID, {
      id: "c2",
      instrumentId: id,
      date: "2026-02-01",
      amount: 300,
      transactionId: null,
      note: null,
    });
    expect(getHolding(db, DEFAULT_USER_ID, id)?.costBasis).toBe(800);

    deleteContribution(db, DEFAULT_USER_ID, "c1");
    expect(getHolding(db, DEFAULT_USER_ID, id)?.costBasis).toBe(300);

    deleteContribution(db, DEFAULT_USER_ID, "c2");
    expect(getHolding(db, DEFAULT_USER_ID, id)?.costBasis).toBe(300);
    expect(listContributions(db, DEFAULT_USER_ID, id)).toHaveLength(0);
  });

  it("deletes instrument cascades holdings and contributions", () => {
    const db = openDb(":memory:");
    migrate(db);
    const id = "inst1";
    upsertInstrument(db, DEFAULT_USER_ID, {
      id,
      name: "VWCE",
      type: "etf",
      ticker: null,
      isin: null,
      currency: "EUR",
      notes: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    upsertHolding(db, DEFAULT_USER_ID, {
      instrumentId: id,
      quantity: 10,
      cashBalance: null,
      costBasis: 0,
      asOf: "2026-01-01",
    });
    addContribution(db, DEFAULT_USER_ID, {
      id: "c1",
      instrumentId: id,
      date: "2026-01-01",
      amount: 500,
      transactionId: null,
      note: null,
    });
    deleteInstrument(db, DEFAULT_USER_ID, id);
    expect(listInstruments(db, DEFAULT_USER_ID)).toHaveLength(0);
    expect(getHolding(db, DEFAULT_USER_ID, id)).toBeUndefined();
  });

  it("linkTransaction creates a contribution from the transaction's absolute amount", () => {
    const db = openDb(":memory:");
    migrate(db);
    const id = "inst1";
    upsertInstrument(db, DEFAULT_USER_ID, {
      id,
      name: "VWCE",
      type: "etf",
      ticker: null,
      isin: null,
      currency: "EUR",
      notes: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    upsertHolding(db, DEFAULT_USER_ID, {
      instrumentId: id,
      quantity: 0,
      cashBalance: null,
      costBasis: 0,
      asOf: null,
    });
    db.prepare(
      `INSERT INTO transactions (user_id, id, date, description, amount, currency, source, category, internal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(DEFAULT_USER_ID, "tx1", "2026-03-01", "Bonifico PAC", -200, "EUR", "mediolanum", "Investimenti", 0);

    const contribution = linkTransaction(db, DEFAULT_USER_ID, id, "tx1");
    expect(contribution.amount).toBe(200);
    expect(contribution.date).toBe("2026-03-01");
    expect(contribution.transactionId).toBe("tx1");
    expect(getHolding(db, DEFAULT_USER_ID, id)?.costBasis).toBe(200);
  });
});
