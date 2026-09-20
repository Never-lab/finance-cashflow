/**
 * Filtro “consumo reale” per KPI, budget e advisor (esclude trasferimenti tra conti propri).
 *
 * Si appoggia a `internal.forCashflow` e regole Revolut/Mediolanum in `revolutFunding`;
 * la UI dashboard usa `forConsumption` per savings rate e grafici spesa.
 */
import type { Transaction } from "../types";
import { forCashflow } from "./internal";
import { isMediolanumRevolutFunding, isRevolutBankTopUp } from "./revolutFunding";

/** Categorie mai incluse nei KPI consumo (anche se internal=false). */
export const NON_CONSUMPTION_CATEGORIES = new Set(["Trasferimenti"]);

/**
 * Movimento non conteggiato come reddito/spesa reale (giroconti, top-up pocket, ecc.).
 * @param t - Transazione con flag internal e categoria già risolti dove possibile
 */
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

/**
 * Sottoinsieme per KPI e grafici: cash-flow senza categoria Trasferimenti.
 * @param txns - Tutte le transazioni (internal già risolto lato chiamante se serve)
 */
export function forConsumption(txns: Transaction[]): Transaction[] {
  return forCashflow(txns).filter((t) => !NON_CONSUMPTION_CATEGORIES.has(t.category));
}

/**
 * Savings rate percentuale arrotondata a 0,1% sui movimenti passati.
 * @param txns - Di solito output di forConsumption
 * @returns 0 se entrate nulle
 */
export function consumptionSavingsRate(txns: Transaction[]): number {
  let income = 0;
  let expense = 0;
  for (const t of txns) {
    if (t.amount > 0) income += t.amount;
    else expense += -t.amount;
  }
  return income > 0 ? Math.round(((income - expense) / income) * 1000) / 10 : 0;
}

/** Conta quante righe sono nascoste dalla vista consumo (debug/UI badge). */
export function countHiddenFromConsumption(all: Transaction[]): number {
  return all.filter(isNonConsumption).length;
}
