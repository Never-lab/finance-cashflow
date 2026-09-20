import { describe, expect, it } from "vitest";
import { parseMediolanum } from "./parseMediolanum";
import { parseRevolut } from "./parseRevolut";
import { withResolvedInternal } from "./internal";
import { buildLiquidityView, parseMediolanumBalances, parseRevolutBalances } from "./liquidity";
import { buildMediolanumBuffer, MEDIOLANUM_BUFFER_OVERSHOOT } from "./mediolanumBuffer";
import { hasRealBankFixtures, readUtf8, REAL_MED, REAL_REV } from "../test/fixtures";

function fixtureTransactions() {
  return [
    ...parseMediolanum(readUtf8(REAL_MED)),
    ...parseRevolut(readUtf8(REAL_REV)),
  ].map((t) => withResolvedInternal(t, {}));
}

describe("mediolanumBuffer", () => {
  it.skipIf(!hasRealBankFixtures())("computes recommended buffer from Mediolanum SDD history", () => {
    const tx = fixtureTransactions();
    const rev = parseRevolut(readUtf8(REAL_REV));
    const liquidity = buildLiquidityView(
      {
        mediolanum: parseMediolanumBalances(readUtf8(REAL_MED))!,
        revolut: parseRevolutBalances(readUtf8(REAL_REV))!,
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
    const tx = hasRealBankFixtures()
      ? fixtureTransactions()
      : [
          {
            id: "med-1",
            date: "2026-08-28",
            description: "ADDEBITO DIRETTO CORE SKY",
            amount: -24.9,
            currency: "EUR",
            source: "mediolanum" as const,
            category: "Abbonamenti",
          },
        ];
    const available = hasRealBankFixtures() ? 468 : 50;
    const buf = buildMediolanumBuffer(tx, {
      mediolanum: {
        ledger: available,
        available,
        asOf: "2026-08-28",
        importedAt: "2026-08-28",
      },
      revolut: null,
      revolutAttualeEffective: null,
      pockets: null,
      totalEur: available,
      note: null,
    })!;

    expect(buf.currentAvailable).toBe(available);
    expect(buf.gap).toBeGreaterThan(0);
    expect(buf.status).not.toBe("ok");
  });

  it("returns null without Mediolanum transactions", () => {
    expect(buildMediolanumBuffer([], null)).toBeNull();
  });
});
