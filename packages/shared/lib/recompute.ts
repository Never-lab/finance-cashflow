/**
 * Ricalcolo categorie e flag internal su transazioni già importate.
 *
 * Utile dopo aggiornamento euristiche in `categorize` / `internal` senza re-import CSV;
 * rispetta sempre override manuali in `AppState`.
 */
import { categorize } from "./categorize";
import { detectInternal } from "./internal";
import type { Transaction } from "../types";

/** Statistiche di un batch di ricalcolo (report API/UI). */
export type RecomputeReport = {
  transactions: number;
  categoriesUpdated: number;
  internalUpdated: number;
  instrumentsRecalced: number;
  investmentInstrumentsEnsured?: number;
  investmentContributionsLinked?: number;
};

/**
 * Riapplica categorize + detectInternal su una transazione.
 * @param t - Movimento corrente
 * @param categoryOverrides - Map id → categoria forzata
 * @param internalOverrides - Map id → internal forzato
 * @returns Transazione aggiornata e flag se categoria/internal sono cambiati rispetto al persistito
 */
export function recomputeTransaction(
  t: Transaction,
  categoryOverrides: Record<string, string>,
  internalOverrides: Record<string, boolean>,
): { transaction: Transaction; categoryChanged: boolean; internalChanged: boolean } {
  const hasCatOverride = Object.prototype.hasOwnProperty.call(categoryOverrides, t.id);
  const hasIntOverride = Object.prototype.hasOwnProperty.call(internalOverrides, t.id);

  const category = hasCatOverride
    ? categoryOverrides[t.id]!
    : categorize(t.description, "", t.description);

  const internal = hasIntOverride
    ? internalOverrides[t.id]!
    : detectInternal({
        source: t.source,
        description: t.description,
        rawDescription: t.description,
      });

  const categoryChanged = !hasCatOverride && category !== t.category;
  const internalChanged = !hasIntOverride && internal !== !!t.internal;

  return {
    transaction: {
      ...t,
      category: hasCatOverride ? categoryOverrides[t.id]! : category,
      internal,
    },
    categoryChanged,
    internalChanged,
  };
}
