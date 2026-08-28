import { describe, expect, it } from "vitest";
import { findRecurring, isSubscriptionLike, recurringKey } from "./recurring";
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

  it("amortizes semi-annual insurance and excludes from subscription-like", () => {
    const rows = [
      tx({
        id: "1",
        date: "2025-12-01",
        description: "ALLIANZ SPA TRIESTE",
        amount: -636,
        category: "Assicurazioni",
      }),
      tx({
        id: "2",
        date: "2026-06-01",
        description: "ALLIANZ SPA TRIESTE",
        amount: -636,
        category: "Assicurazioni",
      }),
    ];
    const found = findRecurring(rows);
    const allianz = found.find((f) => /allianz/i.test(f.label));
    expect(allianz).toBeDefined();
    expect(allianz!.monthlyEstimate).toBeLessThan(150);
    expect(allianz!.monthlyEstimate).toBeGreaterThan(90);
    expect(isSubscriptionLike(allianz!)).toBe(false);
  });

  it("excludes fuel stations from subscription-like", () => {
    const rows = [
      tx({
        id: "1",
        date: "2026-06-10",
        description: "C/O ENILIVE",
        amount: -45.2,
        category: "Trasporti",
      }),
      tx({
        id: "2",
        date: "2026-07-12",
        description: "C/O ENILIVE",
        amount: -48.5,
        category: "Trasporti",
      }),
      tx({
        id: "3",
        date: "2026-08-08",
        description: "C/O ENILIVE",
        amount: -44.0,
        category: "Trasporti",
      }),
    ];
    const found = findRecurring(rows);
    const fuel = found.find((f) => /enilive/i.test(f.label));
    expect(fuel).toBeDefined();
    expect(isSubscriptionLike(fuel!)).toBe(false);
  });

  it("excludes retail and grocery from subscription-like", () => {
    const cases: Array<[string, string]> = [
      ["MediaWorld", "Shopping"],
      ["AMAZON EU", "Shopping"],
      ["Esselunga", "Spesa"],
      ["CONAD", "Spesa"],
    ];
    for (const [label, category] of cases) {
      const item = {
        key: recurringKey(label),
        label,
        category,
        avgAmount: 80,
        months: ["2026-06", "2026-07", "2026-08"],
        count: 3,
        lastDate: "2026-08-01",
        monthlyEstimate: 80,
      };
      expect(isSubscriptionLike(item)).toBe(false);
    }
    const prime = {
      key: "amazon prime",
      label: "Amazon Prime",
      category: "Abbonamenti",
      avgAmount: 4.99,
      months: ["2026-06", "2026-07"],
      count: 2,
      lastDate: "2026-07-01",
      monthlyEstimate: 4.99,
    };
    expect(isSubscriptionLike(prime)).toBe(true);
  });

  it("excludes SEPA bonifici from subscription-like", () => {
    const item = {
      key: "bonifico sepa",
      label: "BONIFICO - SEPA ISTANTANEO NICHOLAS ANTINORI",
      category: "Trasferimenti",
      avgAmount: 350,
      months: ["2026-06", "2026-07"],
      count: 2,
      lastDate: "2026-07-01",
      monthlyEstimate: 350,
    };
    expect(isSubscriptionLike(item)).toBe(false);
  });
});
