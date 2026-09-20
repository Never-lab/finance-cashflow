import { describe, expect, it } from "vitest";
import { detectKnownInvestment, PAC_MS_GLOBAL_OPPORTUNITY } from "./knownInvestments";
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
    expect(detectKnownInvestment(t)?.isin).toBe(PAC_MS_GLOBAL_OPPORTUNITY.isin);
  });

  it("matches Global Opportunity fund description", () => {
    const t: Transaction = {
      id: "2",
      date: "2026-03-10",
      description: "Versamento Morgan Stanley Global Opportunity 41554002",
      amount: -150,
      currency: "EUR",
      source: "mediolanum",
      category: "Altro",
    };
    expect(detectKnownInvestment(t)?.id).toBe(PAC_MS_GLOBAL_OPPORTUNITY.id);
  });
});
