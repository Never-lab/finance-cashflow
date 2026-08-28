import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMediolanum } from "./parseMediolanum";
import { parseRevolut } from "./parseRevolut";
import { withResolvedInternal } from "./internal";
import { buildLiquidityView, parseMediolanumBalances, parseRevolutBalances } from "./liquidity";
import { buildMediolanumBuffer, MEDIOLANUM_BUFFER_OVERSHOOT } from "./mediolanumBuffer";

const medPath = "fixtures/Elenco movimenti dal 28-08-2025 al 28-08-2026.csv";
const revPath = "fixtures/account-statement_2025-07-29_2026-08-28_it-it_50d25d.csv";

function fixtureTransactions() {
  return [
    ...parseMediolanum(fs.readFileSync(medPath, "utf8")),
    ...parseRevolut(fs.readFileSync(revPath, "utf8")),
  ].map((t) => withResolvedInternal(t, {}));
}

describe("mediolanumBuffer", () => {
  it("computes recommended buffer from Mediolanum SDD history", () => {
    const tx = fixtureTransactions();
    const rev = parseRevolut(fs.readFileSync(revPath, "utf8"));
    const liquidity = buildLiquidityView(
      {
        mediolanum: parseMediolanumBalances(fs.readFileSync(medPath, "utf8"))!,
        revolut: parseRevolutBalances(fs.readFileSync(revPath, "utf8"))!,
      },
      rev,
    );
    const buf = buildMediolanumBuffer(tx, liquidity)!;

    expect(buf.monthlyBase).toBeGreaterThan(600);
    expect(buf.recommendedNormal).toBeGreaterThanOrEqual(buf.monthlyBase + MEDIOLANUM_BUFFER_OVERSHOOT);
    expect(buf.recommendedPeak).toBeGreaterThanOrEqual(buf.recommendedNormal);
    expect(buf.lines.some((l) => l.id === "avvera")).toBe(true);
    expect(buf.lines.some((l) => l.id === "emergency")).toBe(true);
  });

  it("flags low balance when available is below target", () => {
    const tx = fixtureTransactions();
    const buf = buildMediolanumBuffer(tx, {
      mediolanum: {
        ledger: 468,
        available: 468,
        asOf: "2026-08-28",
        importedAt: "2026-08-28",
      },
      revolut: null,
      revolutAttualeEffective: null,
      pockets: null,
      totalEur: 468,
      note: null,
    })!;

    expect(buf.currentAvailable).toBe(468);
    expect(buf.gap).toBeGreaterThan(0);
    expect(buf.status).not.toBe("ok");
  });

  it("returns null without Mediolanum transactions", () => {
    expect(buildMediolanumBuffer([], null)).toBeNull();
  });
});
