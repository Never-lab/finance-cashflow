/**
 * Riconoscimento giroconti Mediolanum ↔ Revolut (pocket, ricariche, depositi).
 *
 * Alimenta `internal.detectInternal` e `consumptionView`: non sono spesa/consumo ma
 * ricollocazione liquidità tra conto corrente e wallet operativo.
 */
import type { Transaction } from "../types";

/**
 * Uscita Mediolanum verso Revolut (bonifico pocket / REVOITM) — gamba “uscita” del top-up.
 * @param input.source - Deve essere mediolanum
 */
export function isMediolanumRevolutFunding(input: {
  source: Transaction["source"];
  description: string;
  rawDescription?: string;
}): boolean {
  if (input.source !== "mediolanum") return false;
  const hay = `${input.description} ${input.rawDescription ?? ""}`;
  return (
    /revoitm|pocket revolut|banca destinataria:.*revolut/i.test(hay) ||
    (/bonifico/i.test(hay) && /revolut/i.test(hay) && !/koti revolution/i.test(hay))
  );
}

/**
 * Entrata Revolut da bonifico bancario (specchio Mediolanum) — gamba “entrata”.
 * Esclude interessi (reddito reale).
 */
export function isRevolutBankTopUp(input: {
  source: Transaction["source"];
  description: string;
  rawDescription?: string;
  tipologia?: string;
}): boolean {
  if (input.source !== "revolut") return false;
  const desc = `${input.description} ${input.rawDescription ?? ""}`;
  const tipo = (input.tipologia ?? "").toLowerCase();
  return (
    /^pagamento da\b/i.test(input.description.trim()) ||
    /^pagamento da\b/i.test(desc) ||
    tipo === "ricarica"
  );
}

/**
 * Spostamenti tra pocket/depositi Revolut (Accredita EUR, To …, Prelievo da Pocket).
 * Marcati internal: non confondere con spesa merchant.
 */
export function isRevolutPocketTransfer(input: {
  description: string;
  rawDescription?: string;
  tipologia?: string;
}): boolean {
  const desc = input.description.trim();
  const hay = `${desc} ${input.rawDescription ?? ""}`;
  const tipo = (input.tipologia ?? "").toLowerCase();

  if (isRevolutBankTopUp({ source: "revolut", description: desc, rawDescription: input.rawDescription, tipologia: input.tipologia })) {
    return true;
  }
  if (/^accredita eur/i.test(desc) || /^accredita eur/i.test(hay)) return true;
  if (/^dal deposito/i.test(desc) || /^per i depositi/i.test(desc)) return true;
  if (/^from instant access/i.test(desc)) return true;
  if (/^prelievo da pocket/i.test(desc)) return true;
  if (/^to [a-z]/i.test(desc)) return true;
  if (tipo === "ricarica") return true;
  return false;
}
