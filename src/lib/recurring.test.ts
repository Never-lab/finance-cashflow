import { describe, expect, it } from "vitest";
import { findRecurring, recurringKey } from "./recurring";
import type { Transaction } from "../types";

function tx(
  partial: Partial<Transaction> & Pick<Transaction, "id" | "date" | "description" | "amount">,
): Transaction {
  return {
    currency: "EUR",
    source: "mediolanum",
    category: "Abbonamenti",
    internal: false,
    ...partial,
  };
}

describe("findRecurring", () => {
  it("groups similar monthly expenses", () => {
    const rows = [
      tx({ id: "1", date: "2026-06-01", description: "Netflix", amount: -15.99 }),
      tx({ id: "2", date: "2026-07-01", description: "Netflix", amount: -15.99 }),
      tx({ id: "3", date: "2026-08-01", description: "Netflix", amount: -15.99 }),
      tx({ id: "4", date: "2026-08-02", description: "Esselunga", amount: -40, category: "Spesa" }),
    ];
    const found = findRecurring(rows);
    expect(found.some((f) => recurringKey(f.label) === "netflix")).toBe(true);
    expect(found.find((f) => f.label === "Netflix")?.months.length).toBe(3);
  });

  it("ignores internal transfers", () => {
    const rows = [
      tx({
        id: "1",
        date: "2026-06-01",
        description: "Ricarica carta prepagata",
        amount: -50,
        internal: true,
      }),
      tx({
        id: "2",
        date: "2026-07-01",
        description: "Ricarica carta prepagata",
        amount: -50,
        internal: true,
      }),
    ];
    expect(findRecurring(rows)).toHaveLength(0);
  });
});
