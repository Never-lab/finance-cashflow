import type Database from "better-sqlite3";
import { KNOWN_INVESTMENTS, matchesKnownInvestment } from "../../src/lib/knownInvestments";
import {
  getInstrument,
  linkTransaction,
  listInstruments,
  upsertHolding,
  upsertInstrument,
} from "./instrumentsRepo";
import { loadAppState } from "./stateRepo";

export type InvestmentSyncReport = {
  instrumentsEnsured: number;
  contributionsLinked: number;
};

/** Ensure known PAC/fondo instruments exist and link matching CSV outflows. */
export function syncKnownInvestmentContributions(db: Database.Database): InvestmentSyncReport {
  const state = loadAppState(db);
  const existingLink = db.prepare(`SELECT 1 FROM contributions WHERE transaction_id = ?`);
  let instrumentsEnsured = 0;
  let contributionsLinked = 0;
  const now = new Date().toISOString();

  for (const known of KNOWN_INVESTMENTS) {
    let instrument =
      listInstruments(db).find((i) => i.isin === known.isin) ??
      getInstrument(db, known.id);

    if (!instrument) {
      upsertInstrument(db, {
        id: known.id,
        name: known.name,
        type: known.type,
        ticker: known.ticker ?? null,
        isin: known.isin,
        currency: "EUR",
        notes: "Creato automaticamente da movimenti CSV",
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
    }

    for (const t of state.transactions) {
      if (!matchesKnownInvestment(t, known)) continue;
      if (existingLink.get(t.id)) continue;
      linkTransaction(db, instrument.id, t.id);
      contributionsLinked++;
    }
  }

  return { instrumentsEnsured, contributionsLinked };
}
