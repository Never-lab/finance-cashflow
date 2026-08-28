import type Database from "better-sqlite3";
import { KNOWN_INVESTMENTS, matchesKnownInvestment } from "../../src/lib/knownInvestments";
import {
  getHolding,
  getInstrument,
  insertContributionIfMissing,
  insertSeedQuoteIfMissing,
  linkTransaction,
  listInstruments,
  recalcCostBasis,
  upsertHolding,
  upsertInstrument,
} from "./instrumentsRepo";
import { loadAppState } from "./stateRepo";

export type InvestmentSyncReport = {
  instrumentsEnsured: number;
  contributionsSeeded: number;
  contributionsLinked: number;
};

function seedNotes(known: (typeof KNOWN_INVESTMENTS)[number]): string {
  const s = known.seed;
  if (!s) return "Creato automaticamente da movimenti CSV";
  return [
    `Contratto Mediolanum ${s.contractRef}.`,
    `Snapshot banca ${s.bankMarkDate}: controvalore ${s.bankMarkValue.toFixed(2)} €.`,
    "Versamenti futuri: aggiungi in tab Investimenti o import CSV.",
  ].join(" ");
}

function applySeedContributions(
  db: Database.Database,
  instrumentId: string,
  known: (typeof KNOWN_INVESTMENTS)[number],
): number {
  if (!known.seedContributions?.length) return 0;
  let seeded = 0;
  for (const c of known.seedContributions) {
    if (
      insertContributionIfMissing(db, {
        id: c.id,
        instrumentId,
        date: c.date,
        amount: c.amount,
        transactionId: null,
        note: c.note ?? null,
      })
    ) {
      seeded++;
    }
  }
  if (seeded > 0) recalcCostBasis(db, instrumentId);
  return seeded;
}

function applySeedHolding(
  db: Database.Database,
  instrumentId: string,
  known: (typeof KNOWN_INVESTMENTS)[number],
  contributionsSeeded: number,
): void {
  const seed = known.seed;
  if (!seed) return;
  const holding = getHolding(db, instrumentId);
  const shouldApply =
    contributionsSeeded > 0 || holding == null || holding.quantity == null;
  if (!shouldApply) return;
  upsertHolding(db, {
    instrumentId,
    quantity: seed.quantity,
    cashBalance: null,
    costBasis: holding?.costBasis ?? 0,
    asOf: seed.asOf,
  });
  recalcCostBasis(db, instrumentId);
}

function applySeedQuote(
  db: Database.Database,
  known: (typeof KNOWN_INVESTMENTS)[number],
): void {
  const seed = known.seed;
  if (!seed?.bankMarkValue || !seed.bankMarkDate || seed.quantity <= 0) return;
  const unitPrice = seed.bankMarkValue / seed.quantity;
  insertSeedQuoteIfMissing(db, known.isin, seed.bankMarkDate, unitPrice);
}

/** Ensure known PAC/fondo instruments exist, seed Mediolanum snapshot, link CSV outflows. */
export function syncKnownInvestmentContributions(db: Database.Database): InvestmentSyncReport {
  const state = loadAppState(db);
  const existingLink = db.prepare(`SELECT 1 FROM contributions WHERE transaction_id = ?`);
  let instrumentsEnsured = 0;
  let contributionsSeeded = 0;
  let contributionsLinked = 0;
  const now = new Date().toISOString();

  for (const known of KNOWN_INVESTMENTS) {
    let instrument =
      listInstruments(db).find((i) => i.isin === known.isin) ??
      getInstrument(db, known.id);

    const notes = seedNotes(known);
    if (!instrument) {
      upsertInstrument(db, {
        id: known.id,
        name: known.name,
        type: known.type,
        ticker: known.ticker ?? null,
        isin: known.isin,
        currency: "EUR",
        notes,
        createdAt: now,
        updatedAt: now,
      });
      upsertHolding(db, {
        instrumentId: known.id,
        quantity: null,
        cashBalance: null,
        costBasis: 0,
        asOf: null,
      });
      instrument = getInstrument(db, known.id)!;
      instrumentsEnsured++;
    } else {
      upsertInstrument(db, {
        ...instrument,
        name: known.name,
        notes,
        updatedAt: now,
      });
    }

    const seeded = applySeedContributions(db, instrument.id, known);
    contributionsSeeded += seeded;
    applySeedHolding(db, instrument.id, known, seeded);
    applySeedQuote(db, known);

    for (const t of state.transactions) {
      if (!matchesKnownInvestment(t, known)) continue;
      if (existingLink.get(t.id)) continue;

      const amt = Math.abs(t.amount);
      const seedRow = db
        .prepare(
          `SELECT id FROM contributions
           WHERE instrument_id = ? AND date = ? AND amount = ? AND transaction_id IS NULL`,
        )
        .get(instrument.id, t.date, amt) as { id: string } | undefined;

      if (seedRow) {
        db.prepare(`UPDATE contributions SET transaction_id = ? WHERE id = ?`).run(
          t.id,
          seedRow.id,
        );
        contributionsLinked++;
        continue;
      }

      linkTransaction(db, instrument.id, t.id);
      contributionsLinked++;
    }
  }

  return { instrumentsEnsured, contributionsSeeded, contributionsLinked };
}
