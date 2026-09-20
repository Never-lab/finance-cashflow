/**
 * Route aggregati portafoglio: riepilogo valore/PnL e serie storica.
 * Endpoint: GET /portfolio/summary, GET /portfolio/history?from&to.
 * Tabelle: instruments, holdings, quotes_cache (ultime close per ticker/ISIN).
 */
import { Hono } from "hono";
import type Database from "better-sqlite3";
import { getDb } from "../db";
import { getHolding, listInstruments } from "../lib/instrumentsRepo";
import { buildSummary, buildHistory, type HistoryLine } from "../lib/portfolioMath";
import type { Holding } from "@shared/types";
import { getUserId } from "../lib/requestContext";
import type { AppEnv } from "../lib/honoTypes";

/** Ultima chiusura in cache per simbolo (ticker o ISIN). */
function lastClose(db: Database.Database, ticker: string): number | null {
  const row = db
    .prepare(`SELECT close FROM quotes_cache WHERE ticker = ? ORDER BY as_of DESC LIMIT 1`)
    .get(ticker) as { close: number } | undefined;
  return row?.close ?? null;
}

/** Serie OHLC semplificata (solo close) fino alla data `to`. */
function closesUpTo(
  db: Database.Database,
  ticker: string,
  to: string,
): { asOf: string; close: number }[] {
  return db
    .prepare(
      `SELECT as_of AS asOf, close FROM quotes_cache WHERE ticker = ? AND as_of <= ? ORDER BY as_of`,
    )
    .all(ticker, to) as { asOf: string; close: number }[];
}

const DEFAULT_HISTORY_DAYS = 90;

/** Data inizio default se `from` non passata in query. */
function defaultFrom(to: string): string {
  const d = new Date(`${to}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - DEFAULT_HISTORY_DAYS);
  return d.toISOString().slice(0, 10);
}

export const portfolioRoutes = new Hono<AppEnv>();

/** GET /api/portfolio/summary — totali, allocazione per tipo, righe per strumento. */
portfolioRoutes.get("/portfolio/summary", (c) => {
  const userId = getUserId(c);
  const db = getDb();
  const instruments = listInstruments(db, userId);
  const rows = instruments.map((instrument) => {
    const holding: Holding =
      getHolding(db, userId, instrument.id) ?? {
        instrumentId: instrument.id,
        quantity: null,
        cashBalance: null,
        costBasis: 0,
        asOf: null,
      };
    const quoteKey = instrument.ticker ?? instrument.isin;
    const price = quoteKey ? lastClose(db, quoteKey) : null;
    return { instrument, holding, price };
  });
  return c.json(buildSummary(rows));
});

/** GET /api/portfolio/history — valore portafoglio nel tempo (default ultimi 90 giorni). */
portfolioRoutes.get("/portfolio/history", (c) => {
  const userId = getUserId(c);
  const db = getDb();
  const to = c.req.query("to") ?? new Date().toISOString().slice(0, 10);
  const from = c.req.query("from") ?? defaultFrom(to);

  const instruments = listInstruments(db, userId);
  const lines: HistoryLine[] = instruments.map((instrument) => {
    const holding: Holding =
      getHolding(db, userId, instrument.id) ?? {
        instrumentId: instrument.id,
        quantity: null,
        cashBalance: null,
        costBasis: 0,
        asOf: null,
      };
    const quoteKey = instrument.ticker ?? instrument.isin;
    const closes = quoteKey ? closesUpTo(db, quoteKey, to) : [];
    return { quantity: holding.quantity, cashBalance: holding.cashBalance, closes };
  });

  const dateSet = new Set<string>([from, to]);
  for (const line of lines) {
    for (const close of line.closes) {
      if (close.asOf >= from && close.asOf <= to) dateSet.add(close.asOf);
    }
  }
  const dates = Array.from(dateSet).sort();

  return c.json(buildHistory(lines, dates));
});
