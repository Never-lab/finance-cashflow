import type { InstrumentType, Transaction } from "../types";

export type KnownInvestment = {
  id: string;
  name: string;
  type: InstrumentType;
  isin: string;
  /** Optional Yahoo ticker for quotes */
  ticker?: string | null;
  match: RegExp[];
};

/** PAC Mediolanum — Morgan Stanley Global Brands Fund A (acc EUR). */
export const PAC_GLOBAL_BRANDS: KnownInvestment = {
  id: "pac-lu0552385295",
  name: "PAC Global Brands (MS)",
  type: "pac",
  isin: "LU0552385295",
  ticker: null,
  match: [
    /LU0552385295/i,
    /global brands/i,
    /morgan stanley.*global brands/i,
    /versamento.*fondi.*0552385295/i,
  ],
};

export const KNOWN_INVESTMENTS: KnownInvestment[] = [PAC_GLOBAL_BRANDS];

export function matchesKnownInvestment(t: Transaction, known: KnownInvestment): boolean {
  if (t.amount >= 0) return false;
  const hay = `${t.description} ${t.category}`;
  return known.match.some((re) => re.test(hay));
}

export function detectKnownInvestment(t: Transaction): KnownInvestment | null {
  for (const known of KNOWN_INVESTMENTS) {
    if (matchesKnownInvestment(t, known)) return known;
  }
  return null;
}

export function isInvestmentOutflow(t: Transaction): boolean {
  return detectKnownInvestment(t) != null;
}
