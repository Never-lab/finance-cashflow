import { Hono } from "hono";
import type Database from "better-sqlite3";
import { getDb } from "../db";
import { getHolding, listInstruments } from "../lib/instrumentsRepo";
import { buildSummary } from "../lib/portfolioMath";
import type { Holding } from "../../src/types";

function lastClose(db: Database.Database, ticker: string): number | null {
  const row = db
    .prepare(`SELECT close FROM quotes_cache WHERE ticker = ? ORDER BY as_of DESC LIMIT 1`)
    .get(ticker) as { close: number } | undefined;
  return row?.close ?? null;
}

export const portfolioRoutes = new Hono();

portfolioRoutes.get("/portfolio/summary", (c) => {
  const db = getDb();
  const instruments = listInstruments(db);
  const rows = instruments.map((instrument) => {
    const holding: Holding =
      getHolding(db, instrument.id) ?? {
        instrumentId: instrument.id,
        quantity: null,
        cashBalance: null,
        costBasis: 0,
        asOf: null,
      };
    const price = instrument.ticker ? lastClose(db, instrument.ticker) : null;
    return { instrument, holding, price };
  });
  return c.json(buildSummary(rows));
});
