/**
 * Ricalcolo batch categorie/interni transazioni e cost basis investimenti.
 * Ruolo: repo — orchestrazione recompute condiviso (@shared) + instruments + investmentSync.
 * Tabelle: transactions, instruments, contributions/holdings.
 */
import type Database from "better-sqlite3";
import { recomputeTransaction } from "@shared/lib/recompute";
import { loadAppState } from "./stateRepo";
import { recalcCostBasis } from "./instrumentsRepo";
import { syncKnownInvestmentContributions } from "./investmentSync";

/** Statistiche restituite dopo un recompute completo. */
export type RecomputeDbReport = {
  transactions: number;
  categoriesUpdated: number;
  internalUpdated: number;
  instrumentsRecalced: number;
  investmentInstrumentsEnsured: number;
  investmentContributionsLinked: number;
};

function toInternalCol(internal: boolean | undefined): number | null {
  return internal === undefined ? null : internal ? 1 : 0;
}

/**
 * Persiste categorie/flag interni ricalcolati e aggiorna cost_basis di ogni strumento.
 * Collega anche versamenti noti da CSV (sync investimenti).
 */
export function recomputeDatabase(db: Database.Database, userId: number): RecomputeDbReport {
  const state = loadAppState(db, userId);
  const update = db.prepare(
    `UPDATE transactions SET category = @category, internal = @internal
     WHERE user_id = @userId AND id = @id`,
  );

  let categoriesUpdated = 0;
  let internalUpdated = 0;

  const applyTx = db.transaction(() => {
    for (const t of state.transactions) {
      const { transaction, categoryChanged, internalChanged } = recomputeTransaction(
        t,
        state.categoryOverrides,
        state.internalOverrides,
      );
      if (categoryChanged || internalChanged) {
        update.run({
          userId,
          id: t.id,
          category: transaction.category,
          internal: toInternalCol(transaction.internal),
        });
        if (categoryChanged) categoriesUpdated++;
        if (internalChanged) internalUpdated++;
      }
    }
  });
  applyTx();

  const instrumentIds = db
    .prepare(`SELECT id FROM instruments WHERE user_id = ?`)
    .all(userId) as { id: string }[];
  for (const { id } of instrumentIds) {
    recalcCostBasis(db, userId, id);
  }

  const investment = syncKnownInvestmentContributions(db, userId);

  return {
    transactions: state.transactions.length,
    categoriesUpdated,
    internalUpdated,
    instrumentsRecalced: instrumentIds.length,
    investmentInstrumentsEnsured: investment.instrumentsEnsured,
    investmentContributionsLinked: investment.contributionsLinked,
  };
}
