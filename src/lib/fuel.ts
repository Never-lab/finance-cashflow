/** Fuel / service-station card spend (not subscriptions). */
export const FUEL_MERCHANT_RE =
  /\benilive\b|eni\s*live|\bc\/o\s*is\b|\bis\s+terni\b|carburante|benzin|\bdiesel\b|stazione\s*serv|\bip\s+(italia|grupp)|\bq8\b|\besso\b|\bshell\b|tamoil|\bagip\b|totalenergies|\bgalp\b|\brepsol\b|petroli|\bapi\s+ip\b|keropetrol|fuel/i;

export function isFuelPurchase(text: string): boolean {
  return FUEL_MERCHANT_RE.test(text);
}
