import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recomputeDatabase } from "./recomputeRepo";
import { loadAppState } from "./stateRepo";

const schema = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../schema.sql"),
  "utf8",
);

function openTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(schema);
  return db;
}

describe("recomputeDatabase", () => {
  it("updates stale categories in sqlite", () => {
    const db = openTestDb();
    db.prepare(
      `INSERT INTO transactions (id, date, description, amount, currency, source, category, internal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "t1",
      "2026-07-31",
      "PAG. MUTUO/FIN. VARI NUM. 740/00136196",
      -109.6,
      "EUR",
      "mediolanum",
      "Altro",
      0,
    );

    const report = recomputeDatabase(db);
    expect(report.categoriesUpdated).toBe(1);
    expect(loadAppState(db).transactions[0]?.category).toBe("Mutuo");
  });
});
