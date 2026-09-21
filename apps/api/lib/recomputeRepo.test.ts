import { describe, expect, it } from "vitest";
import { openDb, migrate } from "../db";
import { DEFAULT_USER_ID } from "./requestContext";
import { recomputeDatabase } from "./recomputeRepo";
import { loadAppState } from "./stateRepo";

describe("recomputeDatabase", () => {
  it("updates stale categories in sqlite", async () => {
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

    const report = await recomputeDatabase(db, DEFAULT_USER_ID);
    expect(report.categoriesUpdated).toBe(1);
    expect(loadAppState(db, DEFAULT_USER_ID).transactions[0]?.category).toBe("Mutuo");
    expect(report.payslipsReparsed).toBe(0);
    expect(report.payslipsSkippedMissingFile).toBe(0);
  });

  it("counts payslips without PDF as skipped", async () => {
    const db = openDb(":memory:");
    migrate(db);
    db.prepare(
      `INSERT INTO payslips (
        user_id, id, period_year, period_month, period_label,
        net_pay, bank_match_status, acc_anomalous, imported_at, parser_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      DEFAULT_USER_ID,
      "osra-2026-07-test",
      2026,
      7,
      "Luglio",
      1500,
      "missing",
      0,
      "2026-07-01T00:00:00.000Z",
      "old",
    );

    const report = await recomputeDatabase(db, DEFAULT_USER_ID);
    expect(report.payslipsSkippedMissingFile).toBe(1);
    expect(report.payslipsReparsed).toBe(0);
  });
});
