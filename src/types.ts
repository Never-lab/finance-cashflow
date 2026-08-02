export type BankSource = "mediolanum" | "revolut";

export type Transaction = {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // +income, -expense
  currency: string;
  source: BankSource;
  category: string;
  /** Heuristic at parse time; display uses resolveInternal + overrides */
  internal?: boolean;
};

export type Period = "month" | "3m" | "all";

export type RecurringMark = "could_cancel" | "cancelled" | "";

export type AppState = {
  transactions: Transaction[];
  categoryOverrides: Record<string, string>;
  recurringMarks: Record<string, RecurringMark>;
  /** Manual override of internal flag (true = exclude from cashflow KPIs) */
  internalOverrides: Record<string, boolean>;
};

export type InstrumentType = "pac" | "etf" | "fondo" | "risparmio" | "deposito";

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

export type Holding = {
  instrumentId: string;
  quantity: number | null;
  cashBalance: number | null;
  costBasis: number;
  asOf: string | null;
};

export type Contribution = {
  id: string;
  instrumentId: string;
  date: string;
  amount: number;
  transactionId?: string | null;
  note?: string | null;
};
