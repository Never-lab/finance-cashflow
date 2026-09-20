/**
 * Provider quotazioni Yahoo Finance (chart API pubblica, User-Agent browser).
 * Ruolo: quotes — nessuna API key; chiamate HTTP verso query1.finance.yahoo.com.
 * Privacy: il ticker richiesto esce verso Yahoo; rispettare ToS/limiti del servizio.
 */
import type { QuoteBar } from "./types";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type YahooChartResponse = {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
        }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
};

function toDateString(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * Parser puro: JSON chart → barre; salta giorni con close null (mercato chiuso).
 * Utile per test con fixture.
 */
export function parseYahooChart(json: YahooChartResponse): QuoteBar[] {
  const result = json.chart?.result?.[0];
  if (!result) {
    throw new Error(json.chart?.error?.description ?? "Yahoo: nessun dato");
  }
  const { timestamp, indicators } = result;
  const quote = indicators.quote[0];
  const bars: QuoteBar[] = [];
  for (let i = 0; i < timestamp.length; i++) {
    const close = quote.close[i];
    if (close == null) continue;
    bars.push({
      asOf: toDateString(timestamp[i]),
      open: quote.open[i] ?? null,
      high: quote.high[i] ?? null,
      low: quote.low[i] ?? null,
      close,
      source: "yahoo",
    });
  }
  return bars;
}

async function fetchChart(ticker: string, range: string): Promise<QuoteBar[]> {
  const url = `${YAHOO_BASE}/${encodeURIComponent(ticker)}?interval=1d&range=${range}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const json = (await res.json()) as YahooChartResponse;
  return parseYahooChart(json);
}

/** Ultima barra disponibile (range 5 giorni). */
export async function fetchQuote(ticker: string): Promise<QuoteBar> {
  const bars = await fetchChart(ticker, "5d");
  const last = bars[bars.length - 1];
  if (!last) throw new Error(`Yahoo: nessuna quotazione per ${ticker}`);
  return last;
}

/** Storico filtrato nel range richiesto (fetch 1y poi filter). */
export async function fetchHistory(ticker: string, from: string, to: string): Promise<QuoteBar[]> {
  const bars = await fetchChart(ticker, "1y");
  return bars.filter((b) => b.asOf >= from && b.asOf <= to);
}
