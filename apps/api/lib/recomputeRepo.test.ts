import { describe, expect, it } from "vitest";
import { openDb, migrate } from "../db";
import { DEFAULT_USER_ID } from "./requestContext";
import { recomputeDatabase } from "./recomputeRepo";
import { loadAppState } from "./stateRepo";

describe("recomputeDatabase", () => {
  it("updates stale categories in sqlite", () => {
    const db = openDb(":memory:");
    migrate(db);
    db.prepare(
      `INSERT INTO transactions (user_id, id, date, description, amount, currency, source, category, internal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      DEFAULT_USER_ID,
      "t1",
      "2026-07-31",
      "PAG. MUTUO/FIN. VARI NUM. 740/00136196",
      -109.6,
      "EUR",
      "mediolanum",
      "Altro",
      0,
    );

    const report = recomputeDatabase(db, DEFAULT_USER_ID);
    expect(report.categoriesUpdated).toBe(1);
    expect(loadAppState(db, DEFAULT_USER_ID).transactions[0]?.category).toBe("Mutuo");
  });
});
