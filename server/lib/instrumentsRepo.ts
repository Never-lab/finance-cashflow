import type Database from "better-sqlite3";
import type { Contribution, Holding, Instrument } from "../../src/types";

type InstrumentRow = {
  id: string;
  name: string;
  type: string;
  ticker: string | null;
  isin: string | null;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function rowToInstrument(row: InstrumentRow): Instrument {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Instrument["type"],
    ticker: row.ticker,
    isin: row.isin,
    currency: row.currency,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type HoldingRow = {
  instrument_id: string;
  quantity: number | null;
  cash_balance: number | null;
  cost_basis: number;
  as_of: string | null;
};

function rowToHolding(row: HoldingRow): Holding {
  return {
    instrumentId: row.instrument_id,
    quantity: row.quantity,
    cashBalance: row.cash_balance,
    costBasis: row.cost_basis,
    asOf: row.as_of,
  };
}

type ContributionRow = {
  id: string;
  instrument_id: string;
  date: string;
  amount: number;
  transaction_id: string | null;
  note: string | null;
};

function rowToContribution(row: ContributionRow): Contribution {
  return {
    id: row.id,
    instrumentId: row.instrument_id,
    date: row.date,
    amount: row.amount,
    transactionId: row.transaction_id,
    note: row.note,
  };
}

export function listInstruments(db: Database.Database): Instrument[] {
  const rows = db
    .prepare(`SELECT * FROM instruments ORDER BY name`)
    .all() as InstrumentRow[];
  return rows.map(rowToInstrument);
}

export function getInstrument(db: Database.Database, id: string): Instrument | undefined {
  const row = db.prepare(`SELECT * FROM instruments WHERE id = ?`).get(id) as
    | InstrumentRow
    | undefined;
  return row ? rowToInstrument(row) : undefined;
}

export function upsertInstrument(db: Database.Database, instrument: Instrument): void {
  db.prepare(
    `INSERT INTO instruments (id, name, type, ticker, isin, currency, notes, created_at, updated_at)
     VALUES (@id, @name, @type, @ticker, @isin, @currency, @notes, @createdAt, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       type = excluded.type,
       ticker = excluded.ticker,
       isin = excluded.isin,
       currency = excluded.currency,
       notes = excluded.notes,
       updated_at = excluded.updated_at`,
  ).run({
    id: instrument.id,
    name: instrument.name,
    type: instrument.type,
    ticker: instrument.ticker ?? null,
    isin: instrument.isin ?? null,
    currency: instrument.currency,
    notes: instrument.notes ?? null,
    createdAt: instrument.createdAt,
    updatedAt: instrument.updatedAt,
  });
}

export function deleteInstrument(db: Database.Database, id: string): void {
  db.prepare(`DELETE FROM instruments WHERE id = ?`).run(id);
}

export function getHolding(db: Database.Database, instrumentId: string): Holding | undefined {
  const row = db.prepare(`SELECT * FROM holdings WHERE instrument_id = ?`).get(instrumentId) as
    | HoldingRow
    | undefined;
  return row ? rowToHolding(row) : undefined;
}

export function upsertHolding(db: Database.Database, holding: Holding): void {
  db.prepare(
    `INSERT INTO holdings (instrument_id, quantity, cash_balance, cost_basis, as_of)
     VALUES (@instrumentId, @quantity, @cashBalance, @costBasis, @asOf)
     ON CONFLICT(instrument_id) DO UPDATE SET
       quantity = excluded.quantity,
       cash_balance = excluded.cash_balance,
       cost_basis = excluded.cost_basis,
       as_of = excluded.as_of`,
  ).run({
    instrumentId: holding.instrumentId,
    quantity: holding.quantity,
    cashBalance: holding.cashBalance,
    costBasis: holding.costBasis,
    asOf: holding.asOf,
  });
}

export function listContributions(db: Database.Database, instrumentId: string): Contribution[] {
  const rows = db
    .prepare(`SELECT * FROM contributions WHERE instrument_id = ? ORDER BY date`)
    .all(instrumentId) as ContributionRow[];
  return rows.map(rowToContribution);
}

export function insertContributionIfMissing(
  db: Database.Database,
  contribution: Contribution,
): boolean {
  const exists = db.prepare(`SELECT 1 FROM contributions WHERE id = ?`).get(contribution.id);
  if (exists) return false;
  db.prepare(
    `INSERT INTO contributions (id, instrument_id, date, amount, transaction_id, note)
     VALUES (@id, @instrumentId, @date, @amount, @transactionId, @note)`,
  ).run({
    id: contribution.id,
    instrumentId: contribution.instrumentId,
    date: contribution.date,
    amount: contribution.amount,
    transactionId: contribution.transactionId ?? null,
    note: contribution.note ?? null,
  });
  return true;
}

/** Manual bank snapshot quote keyed by ISIN (no Yahoo ticker). */
export function insertSeedQuoteIfMissing(
  db: Database.Database,
  isin: string,
  asOf: string,
  close: number,
): boolean {
  const exists = db
    .prepare(`SELECT 1 FROM quotes_cache WHERE ticker = ? AND as_of = ?`)
    .get(isin, asOf);
  if (exists) return false;
  db.prepare(
    `INSERT INTO quotes_cache (ticker, as_of, open, high, low, close, source, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(isin, asOf, close, close, close, close, "mediolanum", new Date().toISOString());
  return true;
}

export function addContribution(db: Database.Database, contribution: Contribution): void {
  db.prepare(
    `INSERT INTO contributions (id, instrument_id, date, amount, transaction_id, note)
     VALUES (@id, @instrumentId, @date, @amount, @transactionId, @note)`,
  ).run({
    id: contribution.id,
    instrumentId: contribution.instrumentId,
    date: contribution.date,
    amount: contribution.amount,
    transactionId: contribution.transactionId ?? null,
    note: contribution.note ?? null,
  });
  recalcCostBasis(db, contribution.instrumentId);
}

export function deleteContribution(db: Database.Database, id: string): void {
  const row = db.prepare(`SELECT instrument_id FROM contributions WHERE id = ?`).get(id) as
    | { instrument_id: string }
    | undefined;
  db.prepare(`DELETE FROM contributions WHERE id = ?`).run(id);
  if (row) recalcCostBasis(db, row.instrument_id);
}

/** cost_basis = SUM(contributions.amount) when contributions exist, else keep the current (manual) value. */
export function recalcCostBasis(db: Database.Database, instrumentId: string): void {
  const { total, cnt } = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
       FROM contributions WHERE instrument_id = ?`,
    )
    .get(instrumentId) as { total: number; cnt: number };
  if (cnt === 0) return;
  db.prepare(`UPDATE holdings SET cost_basis = ? WHERE instrument_id = ?`).run(
    total,
    instrumentId,
  );
}

export function linkTransaction(
  db: Database.Database,
  instrumentId: string,
  transactionId: string,
  amount?: number,
  date?: string,
): Contribution {
  let amt = amount;
  let dt = date;
  if (amt === undefined || dt === undefined) {
    const tx = db.prepare(`SELECT date, amount FROM transactions WHERE id = ?`).get(
      transactionId,
    ) as { date: string; amount: number } | undefined;
    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);
    if (amt === undefined) amt = Math.abs(tx.amount);
    if (dt === undefined) dt = tx.date;
  }
  const contribution: Contribution = {
    id: crypto.randomUUID(),
    instrumentId,
    date: dt,
    amount: amt,
    transactionId,
    note: null,
  };
  addContribution(db, contribution);
  return contribution;
}
