import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMediolanum } from "./parseMediolanum";
import { parseRevolut } from "./parseRevolut";
import { withResolvedInternal } from "./internal";
import { buildLiquidityView, parseMediolanumBalances, parseRevolutBalances } from "./liquidity";
import { buildLiberationPlan, estimateLifecycleBalance } from "./liberationPlan";

const medPath = "fixtures/Elenco movimenti dal 28-08-2025 al 28-08-2026.csv";
const revPath = "fixtures/account-statement_2025-07-29_2026-08-28_it-it_50d25d.csv";

function fixtureTransactions() {
  const all = [
    ...parseMediolanum(fs.readFileSync(medPath, "utf8")),
    ...parseRevolut(fs.readFileSync(revPath, "utf8")),
  ];
  return all.map((t) => withResolvedInternal(t, {}));
}

describe("liberationPlan", () => {
  it("builds PayPal and Selfy debt progress from fixtures", () => {
    const tx = fixtureTransactions();
    const rev = parseRevolut(fs.readFileSync(revPath, "utf8"));
    const liquidity = buildLiquidityView(
      { mediolanum: parseMediolanumBalances(fs.readFileSync(medPath, "utf8"))!, revolut: parseRevolutBalances(fs.readFileSync(revPath, "utf8"))! },
      rev,
    );
    const plan = buildLiberationPlan(tx, {}, liquidity);

    const paypal = plan.goals.find((g) => g.id === "paypal")!;
    expect(paypal.kind).toBe("debt");
    expect(paypal.remaining).toBeGreaterThan(1000);
    expect(paypal.pct).toBeGreaterThan(0);
    expect(paypal.pct).toBeLessThan(100);

    const selfy = plan.goals.find((g) => g.id === "selfy")!;
    expect(selfy.remaining).toBeCloseTo(2792.4, 0);
    expect(selfy.current).toBeCloseTo(707.6, 0);
    expect(selfy.pct).toBeCloseTo(20.2, 0);
  });

  it("tracks viaggio pocket against annual target", () => {
    const tx = fixtureTransactions();
    const rev = parseRevolut(fs.readFileSync(revPath, "utf8"));
    const liquidity = buildLiquidityView(
      { revolut: parseRevolutBalances(fs.readFileSync(revPath, "utf8"))! },
      rev,
    );
    const viaggio = buildLiberationPlan(tx, {}, liquidity).goals.find((g) => g.id === "viaggio")!;
    expect(viaggio.current).toBeCloseTo(0, 0);
    expect(viaggio.target).toBe(1200);
    expect(viaggio.pct).toBe(0);
  });

  it("detects lifecycle pocket from Tech accreditations", () => {
    const bal = estimateLifecycleBalance([
      {
        id: "1",
        date: "2026-09-01",
        description: "Accredita EUR Tech · Risparmi",
        amount: 100,
        currency: "EUR",
        source: "revolut",
        category: "Trasferimento",
      },
      {
        id: "2",
        date: "2026-09-15",
        description: "Prelievo da Pocket · Risparmi Tech",
        amount: -50,
        currency: "EUR",
        source: "revolut",
        category: "Trasferimento",
      },
    ]);
    expect(bal).toBe(50);
  });
});
