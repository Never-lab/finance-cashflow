import { describe, expect, it } from "vitest";
import { parseMediolanum } from "./parseMediolanum";
import { parseRevolut } from "./parseRevolut";
import { withResolvedInternal } from "./internal";
import { buildLiquidityView, parseMediolanumBalances, parseRevolutBalances } from "./liquidity";
import { buildLiberationPlan, estimateLifecycleBalance } from "./liberationPlan";
import { hasRealBankFixtures, readUtf8, REAL_MED, REAL_REV, SAMPLE_REV } from "../test/fixtures";

function fixtureTransactions() {
  const all = [
    ...parseMediolanum(readUtf8(REAL_MED)),
    ...parseRevolut(readUtf8(REAL_REV)),
  ];
  return all.map((t) => withResolvedInternal(t, {}));
}

describe("liberationPlan", () => {
  it.skipIf(!hasRealBankFixtures())("builds PayPal and Selfy debt progress from fixtures", () => {
    const tx = fixtureTransactions();
    const rev = parseRevolut(readUtf8(REAL_REV));
    const liquidity = buildLiquidityView(
      {
        mediolanum: parseMediolanumBalances(readUtf8(REAL_MED))!,
        revolut: parseRevolutBalances(readUtf8(REAL_REV))!,
      },
      rev,
    );
    const plan = buildLiberationPlan(tx, {}, liquidity);

    const paypal = plan.goals.find((g) => g.id === "paypal")!;
    expect(paypal.kind).toBe("debt");
    expect(paypal.remaining).toBe(0);
    expect(paypal.monthlyHint).toBeNull();
    expect(paypal.pct).toBe(100);
    expect(plan.paypalUnder600).toBe(true);

    const selfy = plan.goals.find((g) => g.id === "selfy")!;
    expect(selfy.remaining).toBeCloseTo(2792.4, 0);
    expect(selfy.current).toBeCloseTo(707.6, 0);
    expect(selfy.pct).toBeCloseTo(20.2, 0);
    expect(selfy.phase).toMatch(/Selfy|colpo/i);
  });

  it("remainingDebt 0 ÔåÆ PayPal goal complete, paypalUnder600 true", () => {
    const plan = buildLiberationPlan([], {}, null);
    const paypal = plan.goals.find((g) => g.id === "paypal")!;
    expect(paypal.remaining).toBe(0);
    expect(paypal.pct).toBe(100);
    expect(paypal.monthlyHint).toBeNull();
    expect(plan.paypalUnder600).toBe(true);
    expect(paypal.phase).toMatch(/chiuso|Selfy/i);
  });

  it("tracks viaggio pocket against annual target from sample Revolut export", () => {
    const tx = parseRevolut(readUtf8(SAMPLE_REV)).map((t) => withResolvedInternal(t, {}));
    const liquidity = buildLiquidityView(
      { revolut: parseRevolutBalances(readUtf8(SAMPLE_REV))! },
      tx,
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
        description: "Accredita EUR Tech ┬À Risparmi",
        amount: 100,
        currency: "EUR",
        source: "revolut",
        category: "Trasferimento",
      },
      {
        id: "2",
        date: "2026-09-15",
        description: "Prelievo da Pocket ┬À Risparmi Tech",
        amount: -50,
        currency: "EUR",
        source: "revolut",
        category: "Trasferimento",
      },
    ]);
    expect(bal).toBe(50);
  });
});
