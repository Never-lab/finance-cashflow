import { describe, it, expect } from "vitest";
import { openDb, migrate } from "../db";
import { DEFAULT_USER_ID } from "./requestContext";
import { loadAppState, replaceAppState, mergeImportIntoDb } from "./stateRepo";

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
});
