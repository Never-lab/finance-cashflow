/**
 * Route quotazioni di mercato: singola barra, storico, refresh batch.
 * Endpoint: GET /quotes/:ticker, GET /quotes/:ticker/history, POST /quotes/refresh.
 * Tabelle: quotes_cache; settings (market_api_key → provider Finnhub vs Yahoo).
 * Privacy: la API key mercato è per-utente in settings; le chiamate esterne espongono solo ticker a Yahoo/Finnhub.
 */
import { Hono } from "hono";
import type Database from "better-sqlite3";
import { getDb } from "../db";
import { getSetting } from "../lib/settingsRepo";
import { listInstruments } from "../lib/instrumentsRepo";
import { fetchHistory, getCachedBars, getOrFetchQuote, upsertBars } from "../lib/quotes";
import { getUserId } from "../lib/requestContext";
import type { AppEnv } from "../lib/honoTypes";

const FINNHUB_GAP_MS = 350;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Chiave Finnhub dell'utente, se configurata. */
function apiKeyFor(db: Database.Database, userId: number): string | null {
  const key = getSetting(db, userId, "market_api_key");
  return key && key.trim() !== "" ? key : null;
}

export const quotesRoutes = new Hono<AppEnv>();

/** GET /api/quotes/:ticker — quotazione live (cache TTL 30 min). */
quotesRoutes.get("/quotes/:ticker", async (c) => {
  const userId = getUserId(c);
  const ticker = c.req.param("ticker");
  const db = getDb();
  try {
    const bar = await getOrFetchQuote(db, ticker, apiKeyFor(db, userId));
    return c.json(bar);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

/** GET /api/quotes/:ticker/history — cache-first, fetch provider se vuoto/scarso. */
quotesRoutes.get("/quotes/:ticker/history", async (c) => {
  const userId = getUserId(c);
  const ticker = c.req.param("ticker");
  const from = c.req.query("from") ?? "1900-01-01";
  const to = c.req.query("to") ?? new Date().toISOString().slice(0, 10);
  const db = getDb();
  try {
    const cached = getCachedBars(db, ticker, from, to);
    if (cached.length >= 5) return c.json(cached);
    const bars = await fetchHistory(ticker, from, to, apiKeyFor(db, userId));
    upsertBars(db, ticker, bars);
    return c.json(bars.length > 0 ? bars : cached);
  } catch (e) {
    const cached = getCachedBars(db, ticker, from, to);
    if (cached.length > 0) return c.json(cached);
    return c.json({ error: (e as Error).message }, 502);
  }
});

/** POST /api/quotes/refresh — aggiorna quotazioni per lista ticker o tutti gli strumenti con ticker. */
quotesRoutes.post("/quotes/refresh", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json<{ tickers?: string[] }>().catch(() => ({}) as { tickers?: string[] });
  const db = getDb();
  const key = apiKeyFor(db, userId);
  const tickers =
    body.tickers && body.tickers.length > 0
      ? body.tickers
      : listInstruments(db, userId)
          .map((i) => i.ticker)
          .filter((t): t is string => !!t);

  const updated: string[] = [];
  const errors: { ticker: string; error: string }[] = [];
  const throttle = key ? FINNHUB_GAP_MS : 0;
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i]!;
    try {
      await getOrFetchQuote(db, ticker, key);
      updated.push(ticker);
    } catch (e) {
      errors.push({ ticker, error: (e as Error).message });
    }
    if (throttle > 0 && i < tickers.length - 1) await sleep(throttle);
  }
  return c.json({ updated, errors });
});
