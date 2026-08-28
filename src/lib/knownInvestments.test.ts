import { describe, expect, it } from "vitest";
import { detectKnownInvestment, PAC_GLOBAL_BRANDS } from "./knownInvestments";
import type { Transaction } from "../types";

describe("knownInvestments", () => {
  it("matches PAC by ISIN", () => {
    const t: Transaction = {
      id: "1",
      date: "2026-08-01",
      description: "Versamento fondi LU0552385295",
      amount: -150,
      currency: "EUR",
      source: "mediolanum",
      category: "Altro",
    };
    expect(detectKnownInvestment(t)?.isin).toBe(PAC_GLOBAL_BRANDS.isin);
  });
});
