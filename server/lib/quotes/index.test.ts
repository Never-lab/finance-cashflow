import { describe, it, expect, vi, afterEach } from "vitest";
import { openDb, migrate } from "../../db";
import { getCachedClose, getOrFetchQuote, selectProvider, upsertBars } from "./index";

describe("selectProvider", () => {
  it("picks finnhub when an api key is set, yahoo otherwise", () => {
    expect(selectProvider(null)).toBe("yahoo");
    expect(selectProvider("")).toBe("yahoo");
    expect(selectProvider("  ")).toBe("yahoo");
    expect(selectProvider("abc123")).toBe("finnhub");
  });
});

describe("upsertBars / getCachedClose", () => {
  it("upserts bars and returns the most recent close", () => {
    const db = openDb(":memory:");
    migrate(db);
    upsertBars(db, "VWCE.DE", [
      { asOf: "2024-11-20", open: 100, high: 101, low: 99, close: 100.5, source: "yahoo" },
      { asOf: "2024-11-21", open: 101, high: 102, low: 100, close: 101.8, source: "yahoo" },
    ]);
    expect(getCachedClose(db, "VWCE.DE")).toBe(101.8);

    // upsert same as_of overwrites instead of duplicating
    upsertBars(db, "VWCE.DE", [
      { asOf: "2024-11-21", open: 101, high: 103, low: 100, close: 102.2, source: "yahoo" },
    ]);
    expect(getCachedClose(db, "VWCE.DE")).toBe(102.2);
    const count = db
      .prepare(`SELECT COUNT(*) AS n FROM quotes_cache WHERE ticker = ?`)
      .get("VWCE.DE") as { n: number };
    expect(count.n).toBe(2);
  });

  it("returns null when nothing cached", () => {
    const db = openDb(":memory:");
    migrate(db);
    expect(getCachedClose(db, "NOPE")).toBeNull();
  });
});

describe("getOrFetchQuote TTL", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not refetch when today's bar was cached < 30 min ago", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(
      `INSERT INTO quotes_cache (ticker, as_of, open, high, low, close, source, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("VWCE.DE", today, 100, 101, 99, 100.5, "yahoo", new Date().toISOString());

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const bar = await getOrFetchQuote(db, "VWCE.DE", null);
    expect(bar.close).toBe(100.5);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refetches when today's cached bar is stale (> 30 min)", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const today = new Date().toISOString().slice(0, 10);
    const staleFetchedAt = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    db.prepare(
      `INSERT INTO quotes_cache (ticker, as_of, open, high, low, close, source, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("VWCE.DE", today, 100, 101, 99, 100.5, "yahoo", staleFetchedAt);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          chart: {
            result: [
              {
                timestamp: [Math.floor(Date.now() / 1000)],
                indicators: { quote: [{ open: [1], high: [2], low: [0.5], close: [1.5] }] },
              },
            ],
            error: null,
          },
        }),
      }),
    );

    const bar = await getOrFetchQuote(db, "VWCE.DE", null);
    expect(bar.close).toBe(1.5);
    expect(getCachedClose(db, "VWCE.DE")).toBe(1.5);
  });
});
