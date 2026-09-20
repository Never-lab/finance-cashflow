/**
 * Euristica carburante / stazione di servizio su descrizioni POS.
 *
 * Usata da `categorize` (Trasporti) e `recurring` (esclude falsi abbonamenti).
 * Non copre abbonamenti telepass — quelli restano nelle regole categorize.
 */

/** Pattern merchant carburante (Eni, Q8, IP, ecc.) — spesa carta, non ricorrente fissa. */
export const FUEL_MERCHANT_RE =
  /\benilive\b|eni\s*live|\beni\b|\bc\/o\s*is\b|\bis\s+terni\b|carburante|benzin|\bdiesel\b|stazione\s*serv|\bip\s+(italia|grupp)|\bq8\b|\besso\b|\bshell\b|tamoil|\bagip\b|totalenergies|\bgalp\b|\brepsol\b|petroli|\bapi\s+ip\b|keropetrol|fuel/i;

/**
 * @param text - Descrizione o haystack concatenato
 * @returns true se il testo indica acquisto carburante
 */
export function isFuelPurchase(text: string): boolean {
  return FUEL_MERCHANT_RE.test(text);
}
