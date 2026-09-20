/**
 * Facade quotazioni: scelta provider, cache SQLite, TTL live.
 * Ruolo: quotes — tabella quotes_cache; provider Yahoo (default) o Finnhub (API key utente).
 * Privacy: ticker/ISIN inviati a terze parti; API key Finnhub per-utente da settings.
 */
import type Database from "better-sqlite3";
import type { QuoteBar } from "./types";
import * as yahoo from "./yahoo";
import * as finnhub from "./finnhub";

export type { QuoteBar };

export type Provider = "yahoo" | "finnhub";

/** Finnhub se è impostata una market_api_key non vuota, altrimenti Yahoo (nessuna chiave richiesta). */
export function selectProvider(apiKey: string | null): Provider {
  return apiKey && apiKey.trim() !== "" ? "finnhub" : "yahoo";
}

/** Ultima barra quotazione dal provider selezionato. */
export async function fetchQuote(ticker: string, apiKey: string | null): Promise<QuoteBar> {
  return selectProvider(apiKey) === "finnhub"
    ? finnhub.fetchQuote(ticker, apiKey as string)
    : yahoo.fetchQuote(ticker);
}

/** Storico daily nel range [from, to]. */
export async function fetchHistory(
  ticker: string,
  from: string,
  to: string,
  apiKey: string | null,
): Promise<QuoteBar[]> {
  return selectProvider(apiKey) === "finnhub"
    ? finnhub.fetchHistory(ticker, from, to, apiKey as string)
    : yahoo.fetchHistory(ticker, from, to);
}

/** Close più recente in cache locale. */
export function getCachedClose(db: Database.Database, ticker: string): number | null {
  const row = db
    .prepare(`SELECT close FROM quotes_cache WHERE ticker = ? ORDER BY as_of DESC LIMIT 1`)
    .get(ticker) as { close: number } | undefined;
  return row?.close ?? null;
}

type CachedBar = QuoteBar & { fetchedAt: string };

function getCachedBar(db: Database.Database, ticker: string, asOf: string): CachedBar | null {
  const row = db
    .prepare(
      `SELECT open, high, low, close, source, fetched_at FROM quotes_cache WHERE ticker = ? AND as_of = ?`,
    )
    .get(ticker, asOf) as
    | { open: number | null; high: number | null; low: number | null; close: number; source: string; fetched_at: string }
    | undefined;
  if (!row) return null;
  return {
    asOf,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    source: row.source,
    fetchedAt: row.fetched_at,
  };
}

const LIVE_TTL_MS = 30 * 60 * 1000;

/** True se fetchedAt è dentro la TTL (default 30 minuti). */
export function isFresh(fetchedAt: string, ttlMs: number = LIVE_TTL_MS): boolean {
  return Date.now() - new Date(fetchedAt).getTime() < ttlMs;
}

/** Upsert batch barre in quotes_cache con fetched_at comune. */
export function upsertBars(db: Database.Database, ticker: string, bars: QuoteBar[]): void {
  if (bars.length === 0) return;
  const stmt = db.prepare(
    `INSERT INTO quotes_cache (ticker, as_of, open, high, low, close, source, fetched_at)
     VALUES (@ticker, @asOf, @open, @high, @low, @close, @source, @fetchedAt)
     ON CONFLICT(ticker, as_of) DO UPDATE SET
       open = excluded.open, high = excluded.high, low = excluded.low,
       close = excluded.close, source = excluded.source, fetched_at = excluded.fetched_at`,
  );
  const fetchedAt = new Date().toISOString();
  const run = db.transaction((rows: QuoteBar[]) => {
    for (const bar of rows) {
      stmt.run({
        ticker,
        asOf: bar.asOf,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        source: bar.source,
        fetchedAt,
      });
    }
  });
  run(bars);
}

/**
 * Quotazione "live" (as_of = oggi): se in cache da meno di 30 min, non rifetch.
 * Altrimenti chiama il provider e aggiorna la cache.
 */
export async function getOrFetchQuote(
  db: Database.Database,
  ticker: string,
  apiKey: string | null,
): Promise<QuoteBar> {
  const today = new Date().toISOString().slice(0, 10);
  const cached = getCachedBar(db, ticker, today);
  if (cached && isFresh(cached.fetchedAt)) {
    const { fetchedAt: _fetchedAt, ...bar } = cached;
    return bar;
  }
  const bar = await fetchQuote(ticker, apiKey);
  upsertBars(db, ticker, [bar]);
  return bar;
}
