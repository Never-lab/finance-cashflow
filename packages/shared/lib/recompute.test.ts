import { describe, expect, it } from "vitest";
import { recomputeTransaction } from "./recompute";
import type { Transaction } from "../types";

function tx(partial: Partial<Transaction> & Pick<Transaction, "id">): Transaction {
  return {
    date: "2026-07-31",
    description: "PAG. MUTUO/FIN. VARI NUM. 740/00136196",
    amount: -109.6,
    currency: "EUR",
    source: "mediolanum",
    category: "Altro",
    internal: false,
    ...partial,
  };
}

describe("recomputeTransaction", () => {
  it("updates category from heuristics when no override", () => {
    const { transaction, categoryChanged } = recomputeTransaction(tx({ id: "1" }), {}, {});
    expect(transaction.category).toBe("Mutuo");
    expect(categoryChanged).toBe(true);
  });

  it("skips category when override exists", () => {
    const { transaction, categoryChanged } = recomputeTransaction(
      tx({ id: "1" }),
      { "1": "Shopping" },
      {},
    );
    expect(transaction.category).toBe("Shopping");
    expect(categoryChanged).toBe(false);
  });

  it("re-detects internal transfers", () => {
    const row = tx({
      id: "2",
      description: "Fondo emergenza Mediolanum",
      amount: -150,
    });
    const { transaction, internalChanged } = recomputeTransaction(row, {}, {});
    expect(transaction.internal).toBe(true);
    expect(internalChanged).toBe(true);
  });
});
