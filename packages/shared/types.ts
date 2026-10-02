/**
 * Tipi condivisi del dominio finanziario (movimenti, stato app, investimenti).
 *
 * Definisce il contratto dati usato da parser CSV, persistenza SQLite/JSON e UI dashboard.
 * Le convenzioni su importi (+ entrate, − uscite) e categorie sono allineate a `lib/categorize` e `lib/appState`.
 */

/** Banca di origine di un movimento importato da CSV. */
export type BankSource = "mediolanum" | "revolut";

/** Singolo movimento bancario normalizzato dopo il parsing. */
export type Transaction = {
  /** Chiave stabile per deduplica e merge import (`lib/csv.transactionId`). */
  id: string;
  /** Data contabile in formato ISO `YYYY-MM-DD`. */
  date: string;
  /** Descrizione mostrata in UI (può differire dal testo grezzo CSV). */
  description: string;
  /** Importo in EUR: positivo = entrata, negativo = uscita. */
  amount: number;
  currency: string;
  source: BankSource;
  /** Categoria di spesa/entrata (euristica o override utente). */
  category: string;
  /** Flag euristica al parse; in UI si usa `resolveInternal` + override manuali. */
  internal?: boolean;
};

/** Finestra temporale per filtri KPI e grafici. */
export type Period = "month" | "3m" | "all";

/** Segnalazione utente su un abbonamento ricorrente (`lib/recurring`). */
export type RecurringMark = "could_cancel" | "cancelled" | "";

/**
 * Stato persistito dell'applicazione (transazioni + override utente).
 * Serializzato in SQLite/backup JSON lato server o client.
 */
export type AppState = {
  transactions: Transaction[];
  /** Override categoria per `Transaction.id`. */
  categoryOverrides: Record<string, string>;
  /** Stato abbonamenti per chiave ricorrente (`recurringKey`). */
  recurringMarks: Record<string, RecurringMark>;
  /** Override manuale del flag internal (true = escluso da KPI cash-flow). */
  internalOverrides: Record<string, boolean>;
};

/** Tipologia strumento in portafoglio investimenti. */
export type InstrumentType = "pac" | "etf" | "fondo" | "risparmio" | "deposito";

/** Metadati di uno strumento finanziario (PAC, ETF, ecc.). */
export type Instrument = {
  id: string;
  name: string;
  type: InstrumentType;
  ticker?: string | null;
  isin?: string | null;
  currency: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Posizione su uno strumento: quantità, cash, costo e data riferimento. */
export type Holding = {
  instrumentId: string;
  quantity: number | null;
  cashBalance: number | null;
  costBasis: number;
  asOf: string | null;
};

/** Versamento verso uno strumento, eventualmente collegato a un movimento bancario. */
export type Contribution = {
  id: string;
  instrumentId: string;
  date: string;
  amount: number;
  transactionId?: string | null;
  note?: string | null;
};
