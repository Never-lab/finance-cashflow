import type Database from "better-sqlite3";
import { recomputeTransaction } from "../../src/lib/recompute";
import { loadAppState } from "./stateRepo";
import { recalcCostBasis } from "./instrumentsRepo";
import { syncKnownInvestmentContributions } from "./investmentSync";

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

/** Persist refreshed categories/internal flags; recalc all instrument cost_basis. */
export function recomputeDatabase(db: Database.Database): RecomputeDbReport {
  const state = loadAppState(db);
  const update = db.prepare(
    `UPDATE transactions SET category = @category, internal = @internal WHERE id = @id`,
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

  const instrumentIds = db.prepare(`SELECT id FROM instruments`).all() as { id: string }[];
  for (const { id } of instrumentIds) {
    recalcCostBasis(db, id);
  }

  const investment = syncKnownInvestmentContributions(db);

  return {
    transactions: state.transactions.length,
    categoriesUpdated,
    internalUpdated,
    instrumentsRecalced: instrumentIds.length,
    investmentInstrumentsEnsured: investment.instrumentsEnsured,
    investmentContributionsLinked: investment.contributionsLinked,
  };
}
