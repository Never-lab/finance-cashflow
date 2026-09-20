/**
 * Conti propri noti (IBAN) per classificare giroconti come internal / fondo emergenza.
 *
 * Dati owner-specifici usati da parser Mediolanum, buffer liquidità e KPI patrimonio;
 * non sostituiscono l’estratto conto ma etichettano bonifici ricorrenti.
 */

/** Metadati conto interno riconoscibile da IBAN in causale. */
export type KnownAccount = {
  id: string;
  /** IBAN normalizzato senza spazi, maiuscolo */
  iban: string;
  /** Etichetta UI e descrizione pulita */
  label: string;
};

/** Conto deposito Mediolanum — fondo emergenza ufficiale (Nicholas Antinori). */
export const EMERGENCY_FUND_DEPOSIT: KnownAccount = {
  id: "mediolanum-emergency-deposit",
  iban: "IT02J0306234210000060114212",
  label: "Fondo emergenza Mediolanum",
};

/** Elenco conti da trattare come movimenti internal (non consumo). */
export const KNOWN_INTERNAL_ACCOUNTS: KnownAccount[] = [EMERGENCY_FUND_DEPOSIT];

/** @param raw - IBAN o testo causale contenente IBAN */
export function normalizeIban(raw: string): string {
  return raw.replace(/\s/g, "").toUpperCase();
}

/**
 * @param text - Descrizione movimento o causale
 * @returns Conto noto se IBAN presente, altrimenti null
 */
export function matchKnownAccount(text: string): KnownAccount | null {
  const hay = normalizeIban(text);
  for (const acc of KNOWN_INTERNAL_ACCOUNTS) {
    if (hay.includes(acc.iban)) return acc;
  }
  return null;
}

/** Bonifico verso fondo emergenza (IBAN o testo esplicito). */
export function isEmergencyFundTransfer(t: { description: string }): boolean {
  if (matchKnownAccount(t.description)) return true;
  return /fondo emergenza mediolanum/i.test(t.description);
}

/**
 * Somma uscite verso deposito emergenza (valore assoluto EUR).
 * @param txns - Movimenti con amount negativo = uscita
 */
export function sumEmergencyFundOutflows(
  txns: { description: string; amount: number }[],
): number {
  return txns
    .filter((t) => t.amount < 0 && isEmergencyFundTransfer(t))
    .reduce((s, t) => s + -t.amount, 0);
}
