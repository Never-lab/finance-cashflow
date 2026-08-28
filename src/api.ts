import type { LoanTarget } from "./lib/loans";
import type { RecomputeReport } from "./lib/recompute";
import type {
  AppState,
  Contribution,
  Holding,
  Instrument,
  InstrumentType,
  RecurringMark,
  Transaction,
} from "./types";
import type { LiquidityView, LiquiditySnapshots } from "./lib/liquidity";
import { apiFetch, setAuthToken } from "./lib/authToken";

export type HealthResponse = { ok: boolean; storage: string; auth: boolean };

export type StateResponse = AppState & { liquidity: LiquidityView };

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
  getHealth: () => apiFetch("/api/health").then((r) => json<HealthResponse>(r)),
  login: async (username: string, password: string) => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { token: string; username: string };
    setAuthToken(data.token);
    return data;
  },
  authMe: async () => {
    const res = await apiFetch("/api/auth/me");
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { username: string; token?: string; auth?: boolean };
    if (data.token) setAuthToken(data.token);
    return data;
  },
  getState: () => apiFetch("/api/state").then((r) => json<StateResponse>(r)),
  mergeTransactions: (transactions: Transaction[], liquidity?: Partial<LiquiditySnapshots>) =>
    apiFetch("/api/transactions/merge", {
      method: "POST",
      body: JSON.stringify({ transactions, liquidity }),
    }).then((r) =>
      json<{ added: number; updated: number; state: AppState; liquidity: LiquidityView }>(r),
    ),
  setCategory: (id: string, category: string) =>
    apiFetch("/api/overrides/category", {
      method: "PUT",
      body: JSON.stringify({ id, category }),
    }).then((r) => json<AppState>(r)),
  setCategoryBulk: (ids: string[], category: string) =>
    apiFetch("/api/overrides/category/bulk", {
      method: "PUT",
      body: JSON.stringify({ ids, category }),
    }).then((r) => json<AppState>(r)),
  setInternal: (id: string, internal: boolean) =>
    apiFetch("/api/overrides/internal", {
      method: "PUT",
      body: JSON.stringify({ id, internal }),
    }).then((r) => json<AppState>(r)),
  setRecurring: (key: string, mark: RecurringMark) =>
    apiFetch("/api/overrides/recurring", {
      method: "PUT",
      body: JSON.stringify({ key, mark }),
    }).then((r) => json<AppState>(r)),
  migrate: (state: AppState, force = false) =>
    apiFetch("/api/migrate", {
      method: "POST",
      body: JSON.stringify({ ...state, force }),
    }).then((r) => json<{ ok: boolean; state: AppState }>(r)),
  listInstruments: () =>
    apiFetch("/api/instruments").then((r) => json<InstrumentWithHolding[]>(r)),
  createInstrument: (instrument: Partial<Instrument>) =>
    apiFetch("/api/instruments", {
      method: "POST",
      body: JSON.stringify(instrument),
    }).then((r) => json<Instrument>(r)),
  updateInstrument: (id: string, patch: Partial<Instrument>) =>
    apiFetch(`/api/instruments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).then((r) => json<Instrument>(r)),
  deleteInstrument: (id: string) =>
    apiFetch(`/api/instruments/${id}`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)),
  setHolding: (id: string, holding: Partial<Holding>) =>
    apiFetch(`/api/instruments/${id}/holding`, {
      method: "PUT",
      body: JSON.stringify(holding),
    }).then((r) => json<Holding>(r)),
  listContributions: (instrumentId: string) =>
    apiFetch(`/api/instruments/${instrumentId}/contributions`).then((r) => json<Contribution[]>(r)),
  addContribution: (instrumentId: string, contribution: Partial<Contribution>) =>
    apiFetch(`/api/instruments/${instrumentId}/contributions`, {
      method: "POST",
      body: JSON.stringify(contribution),
    }).then((r) => json<Contribution>(r)),
  deleteContribution: (id: string) =>
    apiFetch(`/api/contributions/${id}`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)),
  linkTransaction: (instrumentId: string, transactionId: string) =>
    apiFetch(`/api/instruments/${instrumentId}/link-transaction`, {
      method: "POST",
      body: JSON.stringify({ transactionId }),
    }).then((r) => json<Contribution>(r)),
  getPortfolioSummary: () =>
    apiFetch("/api/portfolio/summary").then((r) => json<PortfolioSummary>(r)),
  getPortfolioHistory: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return apiFetch(`/api/portfolio/history${qs ? `?${qs}` : ""}`).then(
      (r) => json<{ date: string; value: number }[]>(r),
    );
  },
  getSettings: () => apiFetch("/api/settings").then((r) => json<Settings>(r)),
  updateSettings: (patch: { marketApiKey?: string; clearApiKey?: boolean }) =>
    apiFetch("/api/settings", {
      method: "PUT",
      body: JSON.stringify(patch),
    }).then((r) => json<Settings>(r)),
  getQuote: (ticker: string) =>
    apiFetch(`/api/quotes/${encodeURIComponent(ticker)}`).then((r) => json<QuoteBar>(r)),
  getQuoteHistory: (ticker: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return apiFetch(`/api/quotes/${encodeURIComponent(ticker)}/history${qs ? `?${qs}` : ""}`).then(
      (r) => json<QuoteBar[]>(r),
    );
  },
  refreshQuotes: (tickers?: string[]) =>
    apiFetch("/api/quotes/refresh", {
      method: "POST",
      body: JSON.stringify({ tickers }),
    }).then((r) => json<{ updated: string[]; errors: { ticker: string; error: string }[] }>(r)),
  getLoanTargets: () =>
    apiFetch("/api/loans/targets").then((r) => json<Record<string, LoanTarget>>(r)),
  setLoanTarget: (key: string, target: LoanTarget | null) =>
    apiFetch("/api/loans/targets", {
      method: "PUT",
      body: JSON.stringify({ key, target }),
    }).then((r) => json<Record<string, LoanTarget>>(r)),
  recompute: () =>
    apiFetch("/api/recompute", { method: "POST" }).then((r) =>
      json<{
        ok: boolean;
        state: AppState;
        loanTargets: Record<string, LoanTarget>;
        report: RecomputeReport;
        liquidity: LiquidityView;
      }>(r),
    ),
};
