import type { Transaction } from "../types";
import { forCashflow } from "./internal";
import { isMediolanumRevolutFunding, isRevolutBankTopUp } from "./revolutFunding";

/** Never shown in consumption KPI / charts (even if internal flag missing). */
export const NON_CONSUMPTION_CATEGORIES = new Set(["Trasferimenti"]);

/** True for own-account moves that are not real income or spending. */
export function isNonConsumption(t: Transaction): boolean {
  if (t.internal) return true;
  if (NON_CONSUMPTION_CATEGORIES.has(t.category)) return true;
  if (
    t.source === "mediolanum" &&
    isMediolanumRevolutFunding({ source: t.source, description: t.description })
  ) {
    return true;
  }
  if (
    t.source === "revolut" &&
    isRevolutBankTopUp({
      source: t.source,
      description: t.description,
      tipologia: undefined,
    })
  ) {
    return true;
  }
  const d = t.description.trim();
  if (/^accredita eur/i.test(d) || /^dal deposito/i.test(d) || /^per i depositi/i.test(d)) {
    return true;
  }
  if (/^to [a-z]/i.test(d)) return true;
  return false;
}

/** Real income + consumption for KPI and charts (no internal / transfer noise). */
export function forConsumption(txns: Transaction[]): Transaction[] {
  return forCashflow(txns).filter((t) => !NON_CONSUMPTION_CATEGORIES.has(t.category));
}

export function consumptionSavingsRate(txns: Transaction[]): number {
  let income = 0;
  let expense = 0;
  for (const t of txns) {
    if (t.amount > 0) income += t.amount;
    else expense += -t.amount;
  }
  return income > 0 ? Math.round(((income - expense) / income) * 1000) / 10 : 0;
}

export function countHiddenFromConsumption(all: Transaction[]): number {
  return all.filter(isNonConsumption).length;
}
