/**
 * Ricalcolo batch categorie/interni, cost basis investimenti, e ri-parse PDF cedolini dal volume.
 * Ruolo: repo — orchestrazione recompute condiviso (@shared) + instruments + investmentSync + payslips.
 * Tabelle: transactions, instruments, contributions/holdings, payslips.
 */
import type Database from "better-sqlite3";
import { recomputeTransaction } from "@shared/lib/recompute";
import {
  enrichPayslipWithBank,
  parsePayslipContent,
} from "@shared/lib/payslip";
import { loadAppState } from "./stateRepo";
import { recalcCostBasis } from "./instrumentsRepo";
import { syncKnownInvestmentContributions } from "./investmentSync";
import { extractPayslipContent } from "./pdfExtract";
import { deletePayslip, listPayslips, upsertPayslip } from "./payslipsRepo";
import { deletePayslipPdf, readPayslipPdf, savePayslipPdf } from "./payslipStorage";

/** Statistiche restituite dopo un recompute completo. */
export type RecomputeDbReport = {
  transactions: number;
  categoriesUpdated: number;
  internalUpdated: number;
  instrumentsRecalced: number;
  investmentInstrumentsEnsured: number;
  investmentContributionsLinked: number;
  payslipsReparsed: number;
  payslipsSkippedMissingFile: number;
};

function toInternalCol(internal: boolean | undefined): number | null {
  return internal === undefined ? null : internal ? 1 : 0;
}

/**
 * Persiste categorie/flag interni ricalcolati, cost_basis, sync investimenti,
 * e ri-parsa i PDF cedolini presenti sul volume.
 */
export async function recomputeDatabase(
  db: Database.Database,
  userId: number,
): Promise<RecomputeDbReport> {
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

  let payslipsReparsed = 0;
  let payslipsSkippedMissingFile = 0;
  const existing = listPayslips(db, userId);
  for (const old of existing) {
    const buffer = readPayslipPdf(userId, old.id);
    if (!buffer) {
      payslipsSkippedMissingFile++;
      continue;
    }
    try {
      const extracted = await extractPayslipContent(buffer);
      const parsed = parsePayslipContent(
        extracted.content,
        extracted.kind,
        old.sourceFile ?? undefined,
      );
      if (!parsed) {
        payslipsSkippedMissingFile++;
        continue;
      }
      const record = enrichPayslipWithBank(
        { ...parsed, importedAt: old.importedAt },
        state.transactions,
      );
      if (record.id !== old.id) {
        savePayslipPdf(userId, record.id, buffer);
        deletePayslipPdf(userId, old.id);
        deletePayslip(db, userId, old.id);
      }
      upsertPayslip(db, userId, record);
      payslipsReparsed++;
    } catch {
      payslipsSkippedMissingFile++;
    }
  }

  return {
    transactions: state.transactions.length,
    categoriesUpdated,
    internalUpdated,
    instrumentsRecalced: instrumentIds.length,
    investmentInstrumentsEnsured: investment.instrumentsEnsured,
    investmentContributionsLinked: investment.contributionsLinked,
    payslipsReparsed,
    payslipsSkippedMissingFile,
  };
}
