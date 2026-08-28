import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncKnownInvestmentContributions } from "./investmentSync";
import { listContributions } from "./instrumentsRepo";

const schema = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../schema.sql"),
  "utf8",
);

describe("syncKnownInvestmentContributions", () => {
  it("creates PAC instrument and links ISIN outflow", () => {
    const db = new Database(":memory:");
    db.exec(schema);
    db.prepare(
      `INSERT INTO transactions (id, date, description, amount, currency, source, category, internal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "pac1",
      "2026-08-01",
      "Versamento PAC LU0552385295 Global Brands",
      -150,
      "EUR",
      "mediolanum",
      "Altro",
      1,
    );

    const report = syncKnownInvestmentContributions(db);
    expect(report.instrumentsEnsured).toBe(1);
    expect(report.contributionsLinked).toBe(1);
    const contribs = listContributions(db, "pac-lu0552385295");
    expect(contribs[0]?.amount).toBe(150);
    expect(contribs[0]?.transactionId).toBe("pac1");
  });
});
