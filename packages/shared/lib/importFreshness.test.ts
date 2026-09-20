import { describe, expect, it } from "vitest";
import {
  IMPORT_FRESHNESS_MAX_AGE_DAYS,
  bankImportFreshness,
  importChecklist,
} from "./importFreshness";
import type { LiquidityView } from "./liquidity";

const NOW = new Date(2026, 8, 10, 12, 0, 0); // local Sep 10 2026

function snap(asOf: string, importedAt = `${asOf}T10:00:00.000Z`) {
  return { asOf, importedAt, ledger: 1000, available: 1000 };
}

function revSnap(asOf: string, importedAt = `${asOf}T10:00:00.000Z`) {
  return {
    asOf,
    importedAt,
    attuale: 200,
    risparmi: 100,
    deposito: 50,
    pendingAttuale: 0,
  };
}

describe("bankImportFreshness", () => {
  it("marks missing snapshot as not ok", () => {
    const row = bankImportFreshness("mediolanum", null, NOW);
    expect(row.ok).toBe(false);
    expect(row.missing).toBe(true);
    expect(row.asOf).toBeNull();
    expect(row.ageDays).toBeNull();
  });

  it("marks fresh snapshot within max age as ok", () => {
    const row = bankImportFreshness("revolut", revSnap("2026-09-01"), NOW);
    expect(row.ok).toBe(true);
    expect(row.missing).toBe(false);
    expect(row.asOf).toBe("2026-09-01");
    expect(row.ageDays).toBe(9);
  });

  it("marks stale snapshot beyond max age as not ok", () => {
    const row = bankImportFreshness(
      "mediolanum",
      snap("2026-08-01"),
      NOW,
      IMPORT_FRESHNESS_MAX_AGE_DAYS,
    );
    expect(row.ok).toBe(false);
    expect(row.missing).toBe(false);
    expect(row.ageDays).toBe(40);
  });

  it("prefers asOf over importedAt for age", () => {
    const row = bankImportFreshness(
      "mediolanum",
      snap("2026-09-08", "2026-07-01T10:00:00.000Z"),
      NOW,
    );
    expect(row.ok).toBe(true);
    expect(row.ageDays).toBe(2);
  });

  it("falls back to importedAt when asOf missing", () => {
    const row = bankImportFreshness(
      "mediolanum",
      { asOf: "", importedAt: "2026-09-05T10:00:00.000Z" },
      NOW,
    );
    expect(row.ok).toBe(true);
    expect(row.ageDays).toBe(5);
  });
});

describe("importChecklist", () => {
  it("returns both banks from liquidity view", () => {
    const liquidity: LiquidityView = {
      mediolanum: snap("2026-09-01"),
      revolut: revSnap("2026-07-01"),
      revolutAttualeEffective: 200,
      pockets: null,
      totalEur: 1350,
      note: null,
    };
    const rows = importChecklist(liquidity, NOW);
    expect(rows).toHaveLength(2);
    expect(rows[0].source).toBe("mediolanum");
    expect(rows[0].ok).toBe(true);
    expect(rows[1].source).toBe("revolut");
    expect(rows[1].ok).toBe(false);
  });
});
