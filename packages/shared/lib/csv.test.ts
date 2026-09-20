import { describe, expect, it } from "vitest";
import { parseAmount, parseDate, transactionId } from "./csv";

describe("parseAmount", () => {
  it("parses EU format", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("-50,00")).toBe(-50);
  });
  it("parses US format", () => {
    expect(parseAmount("1,234.56")).toBe(1234.56);
    expect(parseAmount("-12.5")).toBe(-12.5);
  });
});

describe("parseDate", () => {
  it("parses DMY and ISO", () => {
    expect(parseDate("15/03/2026")).toBe("2026-03-15");
    expect(parseDate("2026-03-15 12:00:00")).toBe("2026-03-15");
  });
});

describe("transactionId", () => {
  it("is stable", () => {
    const a = transactionId("revolut", "2026-01-01", -10, "Coffee Shop");
    const b = transactionId("revolut", "2026-01-01", -10, "  coffee   shop ");
    expect(a).toBe(b);
  });
});
