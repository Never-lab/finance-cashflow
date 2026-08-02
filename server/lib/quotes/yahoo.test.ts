import { describe, it, expect, vi, afterEach } from "vitest";
import { parseYahooChart, fetchQuote, fetchHistory, type YahooChartResponse } from "./yahoo";

function fixture(overrides?: Partial<YahooChartResponse["chart"]>): YahooChartResponse {
  return {
    chart: {
      result: [
        {
          timestamp: [1732060800, 1732147200, 1732233600], // 2024-11-20, 21, 22
          indicators: {
            quote: [
              {
                open: [100.5, 101.2, null],
                high: [101.0, 102.0, null],
                low: [99.8, 100.5, null],
                close: [100.9, 101.8, null], // giorno 3 mercato chiuso -> niente close
              },
            ],
          },
        },
      ],
      error: null,
      ...overrides,
    },
  };
}

describe("parseYahooChart", () => {
  it("maps timestamps + OHLC arrays to QuoteBar[], skipping null-close days", () => {
    const bars = parseYahooChart(fixture());
    expect(bars).toHaveLength(2);
    expect(bars[0]).toEqual({
      asOf: "2024-11-20",
      open: 100.5,
      high: 101.0,
      low: 99.8,
      close: 100.9,
      source: "yahoo",
    });
    expect(bars[1].asOf).toBe("2024-11-21");
    expect(bars[1].close).toBe(101.8);
  });

  it("throws with Yahoo's error description when result is empty", () => {
    const bad: YahooChartResponse = {
      chart: { result: null, error: { code: "Not Found", description: "No data found" } },
    };
    expect(() => parseYahooChart(bad)).toThrow("No data found");
  });
});

describe("yahoo fetchQuote / fetchHistory (mocked fetch)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchQuote returns the last bar from the chart response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fixture(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const bar = await fetchQuote("VWCE.DE");
    expect(bar.asOf).toBe("2024-11-21");
    expect(bar.close).toBe(101.8);
    expect(bar.source).toBe("yahoo");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("query1.finance.yahoo.com/v8/finance/chart/VWCE.DE");
    expect(url).toContain("range=5d");
    expect(init.headers["User-Agent"]).toMatch(/Mozilla/);
  });

  it("fetchHistory filters bars to the requested [from, to] range", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => fixture() }),
    );

    const bars = await fetchHistory("VWCE.DE", "2024-11-21", "2024-11-30");
    expect(bars).toHaveLength(1);
    expect(bars[0].asOf).toBe("2024-11-21");
  });

  it("throws on non-ok HTTP response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(fetchQuote("VWCE.DE")).rejects.toThrow("Yahoo HTTP 429");
  });
});
