/**
 * Riconoscimento finanziamento auto Avvera su estratti conto (SDD / Payment Loan).
 *
 * Separato da mutui Mediolanum generici in `loans.ts`: chiavi contratto e categorie UI
 * “Finanziamento auto” dipendono da queste euristiche.
 */

/**
 * True se la riga descrive una rata o addebito finanziamento auto Avvera (non assicurazione).
 * @param input.description - Testo movimento
 * @param input.category - Categoria già assegnata (opzionale)
 */
export function isCarLoanTransaction(input: {
  description: string;
  category?: string;
}): boolean {
  const hay = input.description;
  if (input.category === "Finanziamento auto") return true;
  return /payment loan/i.test(hay) && /avvera/i.test(hay);
}

/**
 * Estrae chiave bucket prestito da descrizione Avvera (es. `avvera-1076258`).
 * @param description - Descrizione CSV
 * @returns Chiave per `buildLoanSummary` o null
 */
export function carLoanKeyFromDescription(description: string): string | null {
  const m = description.match(/payment loan\s+n\.?\s*(\d+)/i);
  if (m) return `avvera-${m[1]}`;
  if (/avvera/i.test(description) && /prg\.car/i.test(description)) {
    return "avvera-car";
  }
  return null;
}
