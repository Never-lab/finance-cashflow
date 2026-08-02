import { Hono } from "hono";
import type Database from "better-sqlite3";
import { getDb } from "../db";
import { getSetting } from "../lib/settingsRepo";
import { listInstruments } from "../lib/instrumentsRepo";
import { fetchHistory, getOrFetchQuote, upsertBars } from "../lib/quotes";

function apiKeyFor(db: Database.Database): string | null {
  const key = getSetting(db, "market_api_key");
  return key && key.trim() !== "" ? key : null;
}

export const quotesRoutes = new Hono();

quotesRoutes.get("/quotes/:ticker", async (c) => {
  const ticker = c.req.param("ticker");
  const db = getDb();
  try {
    const bar = await getOrFetchQuote(db, ticker, apiKeyFor(db));
    return c.json(bar);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

quotesRoutes.get("/quotes/:ticker/history", async (c) => {
  const ticker = c.req.param("ticker");
  const from = c.req.query("from") ?? "1900-01-01";
  const to = c.req.query("to") ?? new Date().toISOString().slice(0, 10);
  const db = getDb();
  try {
    const bars = await fetchHistory(ticker, from, to, apiKeyFor(db));
    upsertBars(db, ticker, bars);
    return c.json(bars);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

quotesRoutes.post("/quotes/refresh", async (c) => {
  const body = await c.req.json<{ tickers?: string[] }>().catch(() => ({}) as { tickers?: string[] });
  const db = getDb();
  const key = apiKeyFor(db);
  const tickers =
    body.tickers && body.tickers.length > 0
      ? body.tickers
      : listInstruments(db)
          .map((i) => i.ticker)
          .filter((t): t is string => !!t);

  const updated: string[] = [];
  const errors: { ticker: string; error: string }[] = [];
  for (const ticker of tickers) {
    try {
      await getOrFetchQuote(db, ticker, key);
      updated.push(ticker);
    } catch (e) {
      errors.push({ ticker, error: (e as Error).message });
    }
  }
  return c.json({ updated, errors });
});
