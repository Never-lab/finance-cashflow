/**
 * Euristica spesa vacanza (merchant viaggio + pocket Revolut “Risparmi”).
 *
 * Integra `categorize` (categoria Vacanze) e distingue spesa viaggio da movimenti pocket tecnici.
 */
import { isFuelPurchase } from "./fuel";

/** Voli, hotel, attrazioni e merchant legati a viaggi noti (es. Valencia). */
export const VACATION_MERCHANT_RE =
  /valencia|valenciana|bioparc|headout|ferrocarrils|emt valencia|club avolta|duty free|casa baldo|tasqueta|puray punjabi|salamandra|alabau|panader|llacer|captain candy|\bcork\b|museo trattoria|booking\.com|airbnb|ryanair|easyjet|wizz ?air|vueling|lufthansa|hostelworld|lastminute|edreams|kiwi\.com|getyourguide|viator/i;

/** Righe pocket da ignorare anche se contengono “· Risparmi”. */
const VACATION_POCKET_SKIP_RE =
  /prelievo da pocket|accredita eur|from instant access|interessi netti|per i depositi|manutenzione auto|viaggio novembre|dal deposito/i;

/**
 * Spesa carta dal pocket vacanza Revolut (descrizione con “· Risparmi”).
 * @param text - Descrizione completa movimento
 */
export function isRevolutVacationPocket(text: string): boolean {
  if (!/·\s*risparmi/i.test(text)) return false;
  if (VACATION_POCKET_SKIP_RE.test(text)) return false;
  if (isFuelPurchase(text)) return false;
  return true;
}

/**
 * @param text - Haystack descrizione + raw
 * @returns true se classificabile come vacanza
 */
export function isVacationSpend(text: string): boolean {
  if (VACATION_MERCHANT_RE.test(text)) return true;
  if (isRevolutVacationPocket(text)) return true;
  return false;
}
