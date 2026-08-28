import { isFuelPurchase } from "./fuel";

/** Flights, lodging, attractions, and known trip merchants. */
export const VACATION_MERCHANT_RE =
  /valencia|valenciana|bioparc|headout|ferrocarrils|emt valencia|club avolta|duty free|casa baldo|tasqueta|puray punjabi|salamandra|alabau|panader|llacer|captain candy|\bcork\b|museo trattoria|booking\.com|airbnb|ryanair|easyjet|wizz ?air|vueling|lufthansa|hostelworld|lastminute|edreams|kiwi\.com|getyourguide|viator/i;

const VACATION_POCKET_SKIP_RE =
  /prelievo da pocket|accredita eur|from instant access|interessi netti|per i depositi|manutenzione auto|viaggio novembre|dal deposito/i;

/** Revolut card spend from the trip savings pocket (e.g. Valencia Aug 2026). */
export function isRevolutVacationPocket(text: string): boolean {
  if (!/·\s*risparmi/i.test(text)) return false;
  if (VACATION_POCKET_SKIP_RE.test(text)) return false;
  if (isFuelPurchase(text)) return false;
  return true;
}

export function isVacationSpend(text: string): boolean {
  if (VACATION_MERCHANT_RE.test(text)) return true;
  if (isRevolutVacationPocket(text)) return true;
  return false;
}
