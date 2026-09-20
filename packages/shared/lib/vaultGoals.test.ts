import { describe, expect, it } from "vitest";
import type { Transaction } from "../types";
import {
  VAULT_DEFAULTS,
  buildVaultGoals,
  estimateVaultBalances,
  mergeVaultBalance,
  vaultP0Id,
} from "./vaultGoals";

function tx(
  partial: Partial<Transaction> & Pick<Transaction, "id" | "date" | "description" | "amount">,
): Transaction {
  return {
    currency: "EUR",
    source: "revolut",
    category: "Trasferimenti",
    ...partial,
  };
}

describe("estimateVaultBalances", () => {
  it("credits Auto and Casa pocket accreditations", () => {
    const bal = estimateVaultBalances([
      tx({
        id: "1",
        date: "2026-09-01",
        description: "To A Magazzino · Risparmi · Accredita EUR Auto",
        amount: 75,
      }),
      tx({
        id: "2",
        date: "2026-09-02",
        description: "To A Magazzino · Risparmi · Accredita EUR Casa",
        amount: 380,
      }),
    ]);
    expect(bal.auto).toBe(75);
    expect(bal.casa).toBe(380);
  });

  it("reduces balance on matching pocket withdrawals", () => {
    const bal = estimateVaultBalances([
      tx({
        id: "1",
        date: "2026-09-01",
        description: "Accredita EUR Auto · Risparmi",
        amount: 200,
      }),
      tx({
        id: "2",
        date: "2026-09-05",
        description: "Prelievo da Pocket Auto · Risparmi",
        amount: -50,
      }),
    ]);
    expect(bal.auto).toBe(150);
  });

  it("does not treat Manutenzione Auto as Vault Auto", () => {
    const bal = estimateVaultBalances([
      tx({
        id: "1",
        date: "2026-09-01",
        description: "Accredita EUR Manutenzione Auto · Risparmi",
        amount: 75,
      }),
      tx({
        id: "2",
        date: "2026-09-02",
        description: "Accredita EUR Auto · Risparmi",
        amount: 100,
      }),
    ]);
    expect(bal.auto).toBe(100);
    expect(bal.casa).toBe(0);
  });
});

describe("mergeVaultBalance", () => {
  it("prefers override over estimate", () => {
    expect(mergeVaultBalance(100, 250)).toEqual({ current: 250, source: "override" });
  });

  it("uses estimate when override absent", () => {
    expect(mergeVaultBalance(100, undefined)).toEqual({ current: 100, source: "estimate" });
  });

  it("treats null override as clear → estimate", () => {
    expect(mergeVaultBalance(80, null)).toEqual({ current: 80, source: "estimate" });
  });
});

describe("vaultP0Id", () => {
  it("is auto before December 2026", () => {
    expect(vaultP0Id(new Date(2026, 10, 30))).toBe("auto");
  });

  it("is casa from December 2026", () => {
    expect(vaultP0Id(new Date(2026, 11, 1))).toBe("casa");
  });
});

describe("buildVaultGoals", () => {
  it("builds progress rows with hardcoded targets", () => {
    const goals = buildVaultGoals(
      [
        tx({
          id: "1",
          date: "2026-09-01",
          description: "Accredita EUR Auto · Risparmi",
          amount: 500,
        }),
      ],
      { casa: 1200 },
      new Date("2026-09-10T12:00:00Z"),
    );
    const auto = goals.find((g) => g.id === "auto")!;
    const casa = goals.find((g) => g.id === "casa")!;
    expect(auto.target).toBe(VAULT_DEFAULTS.auto.target);
    expect(auto.current).toBe(500);
    expect(auto.isP0).toBe(true);
    expect(auto.source).toBe("estimate");
    expect(casa.current).toBe(1200);
    expect(casa.source).toBe("override");
    expect(casa.isP0).toBe(false);
    expect(casa.monthlyHint).toBe(380);
  });
});
