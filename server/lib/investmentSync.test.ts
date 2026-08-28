import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncKnownInvestmentContributions } from "./investmentSync";
import { getHolding, listContributions } from "./instrumentsRepo";
import { PAC_MS_GLOBAL_OPPORTUNITY } from "../../src/lib/knownInvestments";

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
      "2026-03-10",
      "Versamento PAC LU0552385295 Global Opportunity",
      -150,
      "EUR",
      "mediolanum",
      "Altro",
      1,
    );

    const report = syncKnownInvestmentContributions(db);
    expect(report.instrumentsEnsured).toBe(1);
    expect(report.contributionsSeeded).toBe(4);
    expect(report.contributionsLinked).toBe(1);

    const contribs = listContributions(db, "pac-lu0552385295");
    expect(contribs).toHaveLength(4);
    expect(contribs.reduce((s, c) => s + c.amount, 0)).toBe(650);
    expect(contribs.find((c) => c.transactionId === "pac1")?.amount).toBe(150);

    const holding = getHolding(db, "pac-lu0552385295");
    expect(holding?.quantity).toBe(PAC_MS_GLOBAL_OPPORTUNITY.seed!.quantity);
    expect(holding?.costBasis).toBe(650);

    const quote = db
      .prepare(`SELECT close FROM quotes_cache WHERE ticker = ? AND as_of = ?`)
      .get("LU0552385295", "2026-08-27") as { close: number };
    expect(quote.close).toBeCloseTo(702.87 / 4.837, 2);
  });

  it("is idempotent on second sync", () => {
    const db = new Database(":memory:");
    db.exec(schema);
    syncKnownInvestmentContributions(db);
    const second = syncKnownInvestmentContributions(db);
    expect(second.instrumentsEnsured).toBe(0);
    expect(second.contributionsSeeded).toBe(0);
    expect(listContributions(db, "pac-lu0552385295")).toHaveLength(4);
  });
});
