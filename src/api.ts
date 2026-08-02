import type {
  AppState,
  Contribution,
  Holding,
  Instrument,
  InstrumentType,
  RecurringMark,
  Transaction,
} from "./types";

export type InstrumentWithHolding = Instrument & { holding: Holding | null };

export type Settings = { marketProvider: "yahoo" | "finnhub"; hasApiKey: boolean };

export type QuoteBar = {
  asOf: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  source: string;
};

export type PortfolioSummary = {
  totalValue: number;
  totalContributed: number;
  pnl: number;
  pnlPct: number | null;
  cashLiquidity: number;
  allocation: { type: InstrumentType; value: number; pct: number }[];
  lines: {
    instrumentId: string;
    name: string;
    type: InstrumentType;
    value: number;
    contributed: number;
    pnl: number;
    price: number | null;
  }[];
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const api = {
  getState: () => fetch("/api/state").then((r) => json<AppState>(r)),
  mergeTransactions: (transactions: Transaction[]) =>
    fetch("/api/transactions/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions }),
    }).then((r) => json<{ added: number; updated: number; state: AppState }>(r)),
  setCategory: (id: string, category: string) =>
    fetch("/api/overrides/category", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, category }),
    }).then((r) => json<AppState>(r)),
  setInternal: (id: string, internal: boolean) =>
    fetch("/api/overrides/internal", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, internal }),
    }).then((r) => json<AppState>(r)),
  setRecurring: (key: string, mark: RecurringMark) =>
    fetch("/api/overrides/recurring", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, mark }),
    }).then((r) => json<AppState>(r)),
  migrate: (state: AppState, force = false) =>
    fetch("/api/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...state, force }),
    }).then((r) => json<{ ok: boolean; state: AppState }>(r)),
  listInstruments: () =>
    fetch("/api/instruments").then((r) => json<InstrumentWithHolding[]>(r)),
  createInstrument: (instrument: Partial<Instrument>) =>
    fetch("/api/instruments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(instrument),
    }).then((r) => json<Instrument>(r)),
  updateInstrument: (id: string, patch: Partial<Instrument>) =>
    fetch(`/api/instruments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<Instrument>(r)),
  deleteInstrument: (id: string) =>
    fetch(`/api/instruments/${id}`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)),
  setHolding: (id: string, holding: Partial<Holding>) =>
    fetch(`/api/instruments/${id}/holding`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(holding),
    }).then((r) => json<Holding>(r)),
  listContributions: (instrumentId: string) =>
    fetch(`/api/instruments/${instrumentId}/contributions`).then((r) => json<Contribution[]>(r)),
  addContribution: (instrumentId: string, contribution: Partial<Contribution>) =>
    fetch(`/api/instruments/${instrumentId}/contributions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contribution),
    }).then((r) => json<Contribution>(r)),
  deleteContribution: (id: string) =>
    fetch(`/api/contributions/${id}`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)),
  linkTransaction: (instrumentId: string, transactionId: string) =>
    fetch(`/api/instruments/${instrumentId}/link-transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId }),
    }).then((r) => json<Contribution>(r)),
  getPortfolioSummary: () =>
    fetch("/api/portfolio/summary").then((r) => json<PortfolioSummary>(r)),
  getSettings: () => fetch("/api/settings").then((r) => json<Settings>(r)),
  updateSettings: (patch: { marketApiKey?: string; clearApiKey?: boolean }) =>
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<Settings>(r)),
  getQuote: (ticker: string) =>
    fetch(`/api/quotes/${encodeURIComponent(ticker)}`).then((r) => json<QuoteBar>(r)),
  getQuoteHistory: (ticker: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return fetch(`/api/quotes/${encodeURIComponent(ticker)}/history${qs ? `?${qs}` : ""}`).then(
      (r) => json<QuoteBar[]>(r),
    );
  },
  refreshQuotes: (tickers?: string[]) =>
    fetch("/api/quotes/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers }),
    }).then((r) => json<{ updated: string[]; errors: { ticker: string; error: string }[] }>(r)),
};
