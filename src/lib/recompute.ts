import { categorize } from "./categorize";
import { detectInternal } from "./internal";
import type { Transaction } from "../types";

export type RecomputeReport = {
  transactions: number;
  categoriesUpdated: number;
  internalUpdated: number;
  instrumentsRecalced: number;
};

/** Re-apply categorize + internal heuristics; manual overrides are preserved. */
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
