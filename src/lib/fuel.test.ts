import { describe, expect, it } from "vitest";
import { isFuelPurchase } from "./fuel";

describe("isFuelPurchase", () => {
  it("detects enilive and highway service stations", () => {
    expect(isFuelPurchase("PAGAMENTI PAESI UE C/O ENILIVE ROMA")).toBe(true);
    expect(isFuelPurchase("C/O IS TERNI")).toBe(true);
    expect(isFuelPurchase("IP GRUPPO AGIP")).toBe(true);
  });

  it("does not match unrelated merchants", () => {
    expect(isFuelPurchase("Netflix")).toBe(false);
    expect(isFuelPurchase("Esselunga")).toBe(false);
  });
});
