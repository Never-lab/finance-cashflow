/**
 * Catalogo investimenti noti (PAC, ISIN) con seed da estratto Mediolanum.
 *
 * Collega movimenti CSV a strumenti in portafoglio SQLite e flag internal su versamenti;
 * i seed quantità/valore sono snapshot banca quando manca ticker di mercato.
 */
import type { InstrumentType, Transaction } from "../types";

/** Versamento iniziale storico per allineare cost basis. */
export type SeedContribution = {
  id: string;
  date: string;
  amount: number;
  note?: string;
};

/** Snapshot banca per valorizzazione senza quotazione live. */
export type InvestmentSeed = {
  quantity: number;
  asOf: string;
  /** Controvalore banca al seed (EUR) */
  bankMarkValue: number;
  bankMarkDate: string;
  contractRef: string;
};

/** Definizione strumento riconoscibile da regex su descrizione CSV. */
export type KnownInvestment = {
  id: string;
  name: string;
  type: InstrumentType;
  isin: string;
  /** Ticker Yahoo opzionale per quote */
  ticker?: string | null;
  match: RegExp[];
  seed?: InvestmentSeed;
  seedContributions?: SeedContribution[];
};

/** PAC Mediolanum — Morgan Stanley Global Opportunity Fund A (LU0552385295). */
export const PAC_MS_GLOBAL_OPPORTUNITY: KnownInvestment = {
  id: "pac-lu0552385295",
  name: "MS Global Opportunity Fund A (PAC)",
  type: "pac",
  isin: "LU0552385295",
  ticker: null,
  match: [
    /LU0552385295/i,
    /global opportunity/i,
    /morgan stanley.*opportunity/i,
    /41554002/i,
    /versamento.*fondi.*0552385295/i,
  ],
  seed: {
    quantity: 4.837,
    asOf: "2026-08-27",
    bankMarkValue: 702.87,
    bankMarkDate: "2026-08-27",
    contractRef: "001/41554002/09",
  },
  seedContributions: [
    {
      id: "seed-pac-lu0552385295-2025-11-20",
      date: "2025-11-20",
      amount: 200,
      note: "Sottoscrizione (Mediolanum)",
    },
    {
      id: "seed-pac-lu0552385295-2026-01-07",
      date: "2026-01-07",
      amount: 150,
      note: "Aggiuntivo (Mediolanum)",
    },
    {
      id: "seed-pac-lu0552385295-2026-02-09",
      date: "2026-02-09",
      amount: 150,
      note: "Aggiuntivo (Mediolanum)",
    },
    {
      id: "seed-pac-lu0552385295-2026-03-10",
      date: "2026-03-10",
      amount: 150,
      note: "Aggiuntivo (Mediolanum)",
    },
  ],
};

export const KNOWN_INVESTMENTS: KnownInvestment[] = [PAC_MS_GLOBAL_OPPORTUNITY];

/** Solo uscite (versamenti) possono matchare un PAC noto. */
export function matchesKnownInvestment(t: Transaction, known: KnownInvestment): boolean {
  if (t.amount >= 0) return false;
  const hay = `${t.description} ${t.category}`;
  return known.match.some((re) => re.test(hay));
}

/** @returns Primo strumento noto che matcha la transazione */
export function detectKnownInvestment(t: Transaction): KnownInvestment | null {
  for (const known of KNOWN_INVESTMENTS) {
    if (matchesKnownInvestment(t, known)) return known;
  }
  return null;
}

/** Uscita verso investimento catalogato (internal per cash-flow). */
export function isInvestmentOutflow(t: Transaction): boolean {
  return detectKnownInvestment(t) != null;
}
