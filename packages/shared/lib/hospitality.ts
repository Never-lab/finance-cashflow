/**
 * Euristica bar, ristoranti e food delivery su descrizioni carta.
 *
 * Prioritaria rispetto alle regole generiche in `categorize` per evitare “Shopping” su POS ristorazione.
 */

/** Pattern locali e catene HORECA / delivery — spesa variabile, non abbonamento. */
export const HOSPITALITY_RE =
  /\(bar\)|\(ristorante\)|steakhouse|old wild west|wild west|\bofficina 41\b|poscargano|posca dal|\bbar lume\b|pizzeria|trattoria|osteria|birreria|enoteca|mcdonald|burger king|kfc|deliveroo|glovo|uber.?eats|just.?eat|food\s*&\s*drink|gelateria|caffetteria|\bpub\b|\bcocktail|\btavola calda\b|\brotisser|five guys|autogrill|hard rock|tasqueta|\btacos\b|captain candy|puray punjabi|\bcork\b|sushi|poke|kebab|paninoteca|rosticcer/i;

/**
 * @param text - Descrizione movimento
 * @returns true se il merchant è ristorazione/bar
 */
export function isHospitalityVenue(text: string): boolean {
  return HOSPITALITY_RE.test(text);
}
