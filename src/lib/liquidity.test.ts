import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildLiquidityView,
  estimateRevolutPockets,
  extractLiquidityFromCsv,
  parseMediolanumBalances,
  parseRevolutBalances,
} from "./liquidity";
import { parseRevolut } from "./parseRevolut";

const medPath = "fixtures/Elenco movimenti dal 28-08-2025 al 28-08-2026.csv";
const revPath = "fixtures/account-statement_2025-07-29_2026-08-28_it-it_50d25d.csv";

describe("liquidity", () => {
  it("parses Mediolanum preamble balances", () => {
    const med = parseMediolanumBalances(fs.readFileSync(medPath, "utf8"));
    expect(med?.ledger).toBe(474.74);
    expect(med?.available).toBe(467.76);
  });

  it("parses Revolut product balances and pending Attuale", () => {
    const rev = parseRevolutBalances(fs.readFileSync(revPath, "utf8"));
    expect(rev?.attuale).toBe(346.4);
    expect(rev?.risparmi).toBe(90);
    expect(rev?.deposito).toBe(0.35);
    expect(rev?.pendingAttuale).toBe(57.84);
  });

  it("computes effective Attuale matching live app balance", () => {
    const rev = parseRevolutBalances(fs.readFileSync(revPath, "utf8"))!;
    expect(rev.attuale - rev.pendingAttuale).toBeCloseTo(288.56, 2);
  });

  it("estimates Manutenzione Auto ~90 and Viaggio ~0 after Valencia", () => {
    const tx = parseRevolut(fs.readFileSync(revPath, "utf8"));
    const pockets = estimateRevolutPockets(tx);
    expect(pockets.manutenzioneAuto).toBeCloseTo(90, 0);
    expect(pockets.viaggio).toBeCloseTo(0, 0);
  });

  it("builds total liquidity across Mediolanum + Revolut", () => {
    const med = parseMediolanumBalances(fs.readFileSync(medPath, "utf8"))!;
    const rev = parseRevolutBalances(fs.readFileSync(revPath, "utf8"))!;
    const view = buildLiquidityView({ mediolanum: med, revolut: rev }, parseRevolut(fs.readFileSync(revPath, "utf8")));
    expect(view.totalEur).toBeCloseTo(467.76 + 288.56 + 90 + 0.35, 1);
  });

  it("extractLiquidityFromCsv returns patch by source", () => {
    expect(extractLiquidityFromCsv(fs.readFileSync(medPath, "utf8"), "mediolanum").mediolanum?.available).toBe(467.76);
    expect(extractLiquidityFromCsv(fs.readFileSync(revPath, "utf8"), "revolut").revolut?.risparmi).toBe(90);
  });
});
