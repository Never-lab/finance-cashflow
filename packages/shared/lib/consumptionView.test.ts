import { describe, expect, it } from "vitest";
import {
  consumptionSavingsRate,
  countHiddenFromConsumption,
  forConsumption,
} from "./consumptionView";
import { withResolvedInternal } from "./internal";
import type { Transaction } from "../types";

function tx(
  partial: Partial<Transaction> &
    Pick<Transaction, "id" | "date" | "description" | "amount" | "category">,
): Transaction {
  return withResolvedInternal(
    {
      currency: "EUR",
      source: "mediolanum",
      internal: false,
      ...partial,
    },
    {},
  );
}

describe("forConsumption", () => {
  it("excludes Mediolanum → Revolut and keeps stipendio + real spend", () => {
    const rows = [
      tx({ id: "1", date: "2026-08-01", description: "Stipendio", amount: 2500, category: "Stipendio", source: "mediolanum" }),
      tx({
        id: "2",
        date: "2026-08-12",
        description: "Bonifico Pocket Revolut",
        amount: -1190,
        category: "Trasferimenti",
        source: "mediolanum",
      }),
      tx({ id: "3", date: "2026-08-15", description: "Esselunga", amount: -80, category: "Spesa", source: "revolut" }),
    ];
    const c = forConsumption(rows);
    expect(c).toHaveLength(2);
    expect(consumptionSavingsRate(c)).toBeCloseTo(((2500 - 80) / 2500) * 100, 0);
    expect(countHiddenFromConsumption(rows)).toBe(1);
  });

  it("drops Trasferimenti even without internal flag", () => {
    const rows = [
      tx({ id: "1", date: "2026-08-01", description: "Giroconto", amount: -500, category: "Trasferimenti", source: "revolut" }),
      tx({ id: "2", date: "2026-08-02", description: "Netflix", amount: -15, category: "Abbonamenti", source: "revolut" }),
    ];
    expect(forConsumption(rows.map((t) => ({ ...t, internal: false })))).toHaveLength(1);
  });
});
