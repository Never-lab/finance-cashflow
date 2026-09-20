/**
 * Provider quotazioni Finnhub (richiede token API per utente).
 * Ruolo: quotes — REST finnhub.io quote e stock/candle.
 * Privacy: token passato in query string; preferire HTTPS e non loggare URL completi.
 */
import type { QuoteBar } from "./types";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

type FinnhubQuoteResponse = { c: number; h: number; l: number; o: number; pc: number; t: number };
type FinnhubCandleResponse = {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  t: number[];
  s: string;
};

function toDateString(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/** Quotazione corrente da endpoint /quote. */
export async function fetchQuote(ticker: string, apiKey: string): Promise<QuoteBar> {
  const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
  const json = (await res.json()) as FinnhubQuoteResponse;
  if (!json.t || json.c == null) throw new Error(`Finnhub: nessuna quotazione per ${ticker}`);
  return {
    asOf: toDateString(json.t),
    open: json.o ?? null,
    high: json.h ?? null,
    low: json.l ?? null,
    close: json.c,
    source: "finnhub",
  };
}

/** Candele giornaliere nel range UTC [from, to]. */
export async function fetchHistory(
  ticker: string,
  from: string,
  to: string,
  apiKey: string,
): Promise<QuoteBar[]> {
  const fromUnix = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000);
  const toUnix = Math.floor(new Date(`${to}T23:59:59Z`).getTime() / 1000);
  const url = `${FINNHUB_BASE}/stock/candle?symbol=${encodeURIComponent(
    ticker,
  )}&resolution=D&from=${fromUnix}&to=${toUnix}&token=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
  const json = (await res.json()) as FinnhubCandleResponse;
  if (json.s !== "ok") return [];
  return json.t.map((t, i) => ({
    asOf: toDateString(t),
    open: json.o[i] ?? null,
    high: json.h[i] ?? null,
    low: json.l[i] ?? null,
    close: json.c[i],
    source: "finnhub",
  }));
}
