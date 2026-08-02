import { describe, expect, it } from "vitest";
import { mergeImport, parseStateJson, emptyState } from "./db";
import type { Transaction } from "./types";

const row = (id: string, description: string): Transaction => ({
  id,
  date: "2026-08-01",
  description,
  amount: -10,
  currency: "EUR",
  source: "mediolanum",
  category: "Spesa",
  internal: false,
});

describe("mergeImport", () => {
  it("upserts existing ids", () => {
    const state = {
      ...emptyState(),
      transactions: [row("a", "Old")],
    };
    const { state: next, added, updated } = mergeImport(state, [
      row("a", "New"),
      row("b", "Extra"),
    ]);
    expect(added).toBe(1);
    expect(updated).toBe(1);
    expect(next.transactions.find((t) => t.id === "a")?.description).toBe("New");
  });
});

describe("parseStateJson", () => {
  it("round-trips", () => {
    const s = emptyState();
    s.transactions = [row("x", "Test")];
    const parsed = parseStateJson(JSON.stringify({ version: 1, ...s }));
    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.internalOverrides).toEqual({});
  });
});
