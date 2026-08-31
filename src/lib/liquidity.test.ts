import { describe, expect, it } from "vitest";
import {
  buildLiquidityView,
  estimateRevolutPockets,
  extractLiquidityFromCsv,
  parseMediolanumBalances,
  parseRevolutBalances,
} from "./liquidity";
import { parseRevolut } from "./parseRevolut";
import { hasRealBankFixtures, readUtf8, REAL_MED, REAL_REV, SAMPLE_MED, SAMPLE_REV } from "../test/fixtures";

describe("liquidity", () => {
  it("parses Mediolanum preamble balances from sample CSV", () => {
    const med = parseMediolanumBalances(readUtf8(SAMPLE_MED));
    expect(med?.ledger).toBe(100);
    expect(med?.available).toBe(100);
  });

  it("parses Revolut product balances from sample CSV", () => {
    const rev = parseRevolutBalances(readUtf8(SAMPLE_REV));
    expect(rev?.attuale).toBe(254.8);
    expect(rev?.risparmi).toBe(200);
    expect(rev?.deposito).toBe(430.05);
    expect(rev?.pendingAttuale).toBe(0);
  });

  it("computes effective Attuale from sample export", () => {
    const rev = parseRevolutBalances(readUtf8(SAMPLE_REV))!;
    expect(rev.attuale - rev.pendingAttuale).toBeCloseTo(254.8, 2);
  });

  it("estimates pocket balances from sample Revolut movements", () => {
    const tx = parseRevolut(readUtf8(SAMPLE_REV));
    const pockets = estimateRevolutPockets(tx);
    expect(pockets.manutenzioneAuto).toBe(0);
    expect(pockets.viaggio).toBe(0);
  });

  it("builds total liquidity across Mediolanum + Revolut samples", () => {
    const med = parseMediolanumBalances(readUtf8(SAMPLE_MED))!;
    const rev = parseRevolutBalances(readUtf8(SAMPLE_REV))!;
    const view = buildLiquidityView({ mediolanum: med, revolut: rev }, parseRevolut(readUtf8(SAMPLE_REV)));
    expect(view.totalEur).toBeCloseTo(100 + 254.8 + 200 + 430.05, 1);
  });

  it("extractLiquidityFromCsv returns patch by source", () => {
    expect(extractLiquidityFromCsv(readUtf8(SAMPLE_MED), "mediolanum").mediolanum?.available).toBe(100);
    expect(extractLiquidityFromCsv(readUtf8(SAMPLE_REV), "revolut").revolut?.risparmi).toBe(200);
  });

  it.skipIf(!hasRealBankFixtures())("parses real bank export balances when fixtures are present", () => {
    const med = parseMediolanumBalances(readUtf8(REAL_MED));
    expect(med?.ledger).toBe(474.74);
    expect(med?.available).toBe(467.76);

    const rev = parseRevolutBalances(readUtf8(REAL_REV));
    expect(rev?.attuale).toBe(346.4);
    expect(rev?.risparmi).toBe(90);
    expect(rev?.pendingAttuale).toBe(57.84);
  });
});
