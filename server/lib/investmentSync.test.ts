import { describe, expect, it } from "vitest";
import { openDb, migrate } from "../db";
import { DEFAULT_USER_ID } from "./requestContext";
import { syncKnownInvestmentContributions } from "./investmentSync";
import { getHolding, listContributions } from "./instrumentsRepo";
import { PAC_MS_GLOBAL_OPPORTUNITY } from "../../src/lib/knownInvestments";

describe("syncKnownInvestmentContributions", () => {
  it("creates PAC instrument and links ISIN outflow", () => {
    const db = openDb(":memory:");
    migrate(db);
    db.prepare(
      `INSERT INTO transactions (user_id, id, date, description, amount, currency, source, category, internal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      DEFAULT_USER_ID,
      "pac1",
      "2026-03-10",
      "Versamento PAC LU0552385295 Global Opportunity",
      -150,
      "EUR",
      "mediolanum",
      "Altro",
      1,
    );

    const report = syncKnownInvestmentContributions(db, DEFAULT_USER_ID);
    expect(report.instrumentsEnsured).toBe(1);
    expect(report.contributionsSeeded).toBe(4);
    expect(report.contributionsLinked).toBe(1);

    const contribs = listContributions(db, DEFAULT_USER_ID, "pac-lu0552385295");
    expect(contribs).toHaveLength(4);
    expect(contribs.reduce((s, c) => s + c.amount, 0)).toBe(650);
    expect(contribs.find((c) => c.transactionId === "pac1")?.amount).toBe(150);

    const holding = getHolding(db, DEFAULT_USER_ID, "pac-lu0552385295");
    expect(holding?.quantity).toBe(PAC_MS_GLOBAL_OPPORTUNITY.seed!.quantity);
    expect(holding?.costBasis).toBe(650);

    const quote = db
      .prepare(`SELECT close FROM quotes_cache WHERE ticker = ? AND as_of = ?`)
      .get("LU0552385295", "2026-08-27") as { close: number };
    expect(quote.close).toBeCloseTo(702.87 / 4.837, 2);
  });

  it("is idempotent on second sync", () => {
    const db = openDb(":memory:");
    migrate(db);
    syncKnownInvestmentContributions(db, DEFAULT_USER_ID);
    const second = syncKnownInvestmentContributions(db, DEFAULT_USER_ID);
    expect(second.instrumentsEnsured).toBe(0);
    expect(second.contributionsSeeded).toBe(0);
    expect(listContributions(db, DEFAULT_USER_ID, "pac-lu0552385295")).toHaveLength(4);
  });
});
