/**
 * Client HTTP tipizzato verso il backend Cash Flow (`/api/*`).
 * Tutte le chiamate passano da `apiFetch` (token JWT se auth attiva).
 * I metodi restituiscono JSON già parsato e lanciano su risposta non ok.
 */
import type { LoanTarget } from "@shared/lib/loans";
import type { RecomputeReport } from "@shared/lib/recompute";
import type {
  AppState,
  Contribution,
  Holding,
  Instrument,
  InstrumentType,
  RecurringMark,
  Transaction,
} from "@shared/types";
import type { LiquidityView, LiquiditySnapshots } from "@shared/lib/liquidity";
import type { PayslipSummary } from "@shared/lib/payslip";
import type { VaultBalancesOverride, VaultId } from "@shared/lib/vaultGoals";
import type { CategoryBudgets } from "@shared/lib/budget";
import { apiFetch, setAuthToken } from "@shared/lib/authToken";

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

/** Deserializza il body JSON o propaga il testo d'errore del server. */
async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

/** Superficie API usata dai tab e da App.tsx per sincronizzare lo stato. */
export const api = {
  /** GET /api/health — ok, tipo storage, flag auth obbligatoria. */
  getHealth: () => apiFetch("/api/health").then((r) => json<HealthResponse>(r)),
  /** POST /api/auth/login — imposta token in memoria locale. */
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
  /** POST /api/auth/register — crea utente e salva token. */
  register: async (username: string, password: string) => {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Registrazione fallita");
    }
    const data = (await res.json()) as { token: string; username: string };
    setAuthToken(data.token);
    return data;
  },
  /** GET /api/auth/me — valida sessione; può rinnovare il token. */
  authMe: async () => {
    const res = await apiFetch("/api/auth/me");
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { username: string; token?: string; auth?: boolean };
    if (data.token) setAuthToken(data.token);
    return data;
  },
  /** GET /api/state — AppState + vista liquidità conti. */
  getState: () => apiFetch("/api/state").then((r) => json<StateResponse>(r)),
  /** POST /api/transactions/merge — import CSV: merge movimenti e snapshot saldi opzionali. */
  mergeTransactions: (transactions: Transaction[], liquidity?: Partial<LiquiditySnapshots>) =>
    apiFetch("/api/transactions/merge", {
      method: "POST",
      body: JSON.stringify({ transactions, liquidity }),
    }).then((r) =>
      json<{ added: number; updated: number; state: AppState; liquidity: LiquidityView }>(r),
    ),
  /** PUT /api/overrides/category — override categoria su singolo movimento. */
  setCategory: (id: string, category: string) =>
    apiFetch("/api/overrides/category", {
      method: "PUT",
      body: JSON.stringify({ id, category }),
    }).then((r) => json<AppState>(r)),
  /** PUT /api/overrides/category/bulk — stessa categoria su più movimenti (es. merchant ricorrente). */
  setCategoryBulk: (ids: string[], category: string) =>
    apiFetch("/api/overrides/category/bulk", {
      method: "PUT",
      body: JSON.stringify({ ids, category }),
    }).then((r) => json<AppState>(r)),
  /** PUT /api/overrides/internal — marca giroconto/trasferimento interno (escluso dai KPI). */
  setInternal: (id: string, internal: boolean) =>
    apiFetch("/api/overrides/internal", {
      method: "PUT",
      body: JSON.stringify({ id, internal }),
    }).then((r) => json<AppState>(r)),
  /** PUT /api/overrides/recurring — stato abbonamento (cancellato / potrei tagliare). */
  setRecurring: (key: string, mark: RecurringMark) =>
    apiFetch("/api/overrides/recurring", {
      method: "PUT",
      body: JSON.stringify({ key, mark }),
    }).then((r) => json<AppState>(r)),
  /** POST /api/migrate — importa stato JSON/IndexedDB; `force` sovrascrive dati server. */
  migrate: (state: AppState, force = false) =>
    apiFetch("/api/migrate", {
      method: "POST",
      body: JSON.stringify({ ...state, force }),
    }).then((r) => json<{ ok: boolean; state: AppState }>(r)),
  /** GET /api/instruments — elenco strumenti con posizione (holding). */
  listInstruments: () =>
    apiFetch("/api/instruments").then((r) => json<InstrumentWithHolding[]>(r)),
  /** POST /api/instruments — crea PAC/ETF/fondo/risparmio/deposito. */
  createInstrument: (instrument: Partial<Instrument>) =>
    apiFetch("/api/instruments", {
      method: "POST",
      body: JSON.stringify(instrument),
    }).then((r) => json<Instrument>(r)),
  /** PATCH /api/instruments/:id — aggiorna metadati strumento. */
  updateInstrument: (id: string, patch: Partial<Instrument>) =>
    apiFetch(`/api/instruments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).then((r) => json<Instrument>(r)),
  /** DELETE /api/instruments/:id — rimuove strumento e versamenti collegati. */
  deleteInstrument: (id: string) =>
    apiFetch(`/api/instruments/${id}`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)),
  /** PUT /api/instruments/:id/holding — quantità, cost basis o saldo cash. */
  setHolding: (id: string, holding: Partial<Holding>) =>
    apiFetch(`/api/instruments/${id}/holding`, {
      method: "PUT",
      body: JSON.stringify(holding),
    }).then((r) => json<Holding>(r)),
  /** GET /api/instruments/:id/contributions — versamenti registrati. */
  listContributions: (instrumentId: string) =>
    apiFetch(`/api/instruments/${instrumentId}/contributions`).then((r) => json<Contribution[]>(r)),
  /** POST /api/instruments/:id/contributions — nuovo versamento manuale. */
  addContribution: (instrumentId: string, contribution: Partial<Contribution>) =>
    apiFetch(`/api/instruments/${instrumentId}/contributions`, {
      method: "POST",
      body: JSON.stringify(contribution),
    }).then((r) => json<Contribution>(r)),
  /** DELETE /api/contributions/:id */
  deleteContribution: (id: string) =>
    apiFetch(`/api/contributions/${id}`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)),
  /** POST /api/instruments/:id/link-transaction — collega movimento banca a versamento. */
  linkTransaction: (instrumentId: string, transactionId: string) =>
    apiFetch(`/api/instruments/${instrumentId}/link-transaction`, {
      method: "POST",
      body: JSON.stringify({ transactionId }),
    }).then((r) => json<Contribution>(r)),
  /** GET /api/portfolio/summary — KPI patrimonio, allocazione, righe per strumento. */
  getPortfolioSummary: () =>
    apiFetch("/api/portfolio/summary").then((r) => json<PortfolioSummary>(r)),
  /** GET /api/portfolio/history — serie valore patrimonio (query from/to opzionali). */
  getPortfolioHistory: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return apiFetch(`/api/portfolio/history${qs ? `?${qs}` : ""}`).then(
      (r) => json<{ date: string; value: number }[]>(r),
    );
  },
  /** GET /api/settings — provider quotazioni e presenza chiave API. */
  getSettings: () => apiFetch("/api/settings").then((r) => json<Settings>(r)),
  /** PUT /api/settings — chiave Finnhub o reset a Yahoo. */
  updateSettings: (patch: { marketApiKey?: string; clearApiKey?: boolean }) =>
    apiFetch("/api/settings", {
      method: "PUT",
      body: JSON.stringify(patch),
    }).then((r) => json<Settings>(r)),
  /** GET /api/bank-sync/status — link Open Banking. */
  getBankSyncStatus: () =>
    apiFetch("/api/bank-sync/status").then((r) =>
      json<{
        configured: boolean;
        links: {
          source: "mediolanum" | "revolut";
          status: string;
          consentExpiresAt: string | null;
          lastSyncAt: string | null;
          lastError: string | null;
          accountCount: number;
        }[];
      }>(r),
    ),
  /** POST /api/bank-sync/link — URL SCA GoCardless. */
  startBankLink: (source: "mediolanum" | "revolut") =>
    apiFetch("/api/bank-sync/link", {
      method: "POST",
      body: JSON.stringify({ source }),
    }).then((r) => json<{ url: string }>(r)),
  /** POST /api/bank-sync/run — sync immediata. */
  runBankSync: () =>
    apiFetch("/api/bank-sync/run", { method: "POST" }).then((r) =>
      json<{
        results: {
          source: "mediolanum" | "revolut";
          added: number;
          updated: number;
          error?: string;
        }[];
      }>(r),
    ),
  /** GET /api/quotes/:ticker — ultima barra OHLC. */
  getQuote: (ticker: string) =>
    apiFetch(`/api/quotes/${encodeURIComponent(ticker)}`).then((r) => json<QuoteBar>(r)),
  /** GET /api/quotes/:ticker/history — storico prezzi. */
  getQuoteHistory: (ticker: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return apiFetch(`/api/quotes/${encodeURIComponent(ticker)}/history${qs ? `?${qs}` : ""}`).then(
      (r) => json<QuoteBar[]>(r),
    );
  },
  /** POST /api/quotes/refresh — aggiorna cache prezzi (tickers opzionali). */
  refreshQuotes: (tickers?: string[]) =>
    apiFetch("/api/quotes/refresh", {
      method: "POST",
      body: JSON.stringify({ tickers }),
    }).then((r) => json<{ updated: string[]; errors: { ticker: string; error: string }[] }>(r)),
  /** GET /api/loans/targets — override residui/rate contratti mutuo. */
  getLoanTargets: () =>
    apiFetch("/api/loans/targets").then((r) => json<Record<string, LoanTarget>>(r)),
  /** PUT /api/loans/targets — salva o azzera target per chiave contratto. */
  setLoanTarget: (key: string, target: LoanTarget | null) =>
    apiFetch("/api/loans/targets", {
      method: "PUT",
      body: JSON.stringify({ key, target }),
    }).then((r) => json<Record<string, LoanTarget>>(r)),
  /** GET /api/vault/balances — saldi manuali obiettivi Revolut Vault. */
  getVaultBalances: () =>
    apiFetch("/api/vault/balances").then((r) => json<VaultBalancesOverride>(r)),
  /** PUT /api/vault/balances — override saldo vault (null = torna a stima da CSV). */
  setVaultBalance: (id: VaultId, amount: number | null) =>
    apiFetch("/api/vault/balances", {
      method: "PUT",
      body: JSON.stringify({ id, amount }),
    }).then((r) => json<VaultBalancesOverride>(r)),
  /** GET /api/budget — limiti mensili per categoria. */
  getCategoryBudgets: () =>
    apiFetch("/api/budget").then((r) => json<CategoryBudgets>(r)),
  /** PUT /api/budget — imposta o rimuove limite categoria. */
  setCategoryBudget: (category: string, limit: number | null) =>
    apiFetch("/api/budget", {
      method: "PUT",
      body: JSON.stringify({ category, limit }),
    }).then((r) => json<CategoryBudgets>(r)),
  /** GET /api/payslips — riepilogo cedolini e serie per grafici. */
  getPayslips: () => apiFetch("/api/payslips").then((r) => json<PayslipSummary>(r)),
  /** POST /api/payslips/preview — anteprima singolo PDF senza persistenza. */
  previewPayslip: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiFetch("/api/payslips/preview", { method: "POST", body: fd }).then((r) =>
      json<{ payslip: PayslipSummary["payslips"][0] }>(r),
    );
  },
  /** POST /api/payslips/import — import multiplo PDF HR (batch automatici se molti file). */
  importPayslips: async (
    files: File[],
    onProgress?: (done: number, total: number) => void,
  ) => {
    const pdfs = files.filter(
      (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name),
    );
    if (pdfs.length === 0) {
      throw new Error("Nessun file PDF selezionato");
    }

    /** Chunk piccoli: evita body/timeout su import massivi (es. 30 cedolini). */
    const BATCH = 5;
    let imported = 0;
    const errors: { file: string; error: string }[] = [];
    let summary: PayslipSummary | null = null;
    let done = 0;

    for (let i = 0; i < pdfs.length; i += BATCH) {
      const chunk = pdfs.slice(i, i + BATCH);
      const fd = new FormData();
      for (const f of chunk) fd.append("files", f);
      const res = await apiFetch("/api/payslips/import", { method: "POST", body: fd }).then((r) =>
        json<{
          imported: number;
          errors: { file: string; error: string }[];
          summary: PayslipSummary;
        }>(r),
      );
      imported += res.imported;
      errors.push(...res.errors);
      summary = res.summary;
      done = Math.min(pdfs.length, i + chunk.length);
      onProgress?.(done, pdfs.length);
    }

    if (!summary) throw new Error("Import fallito");
    return { imported, errors, summary };
  },
  /** DELETE /api/payslips/:id */
  deletePayslip: (id: string) =>
    apiFetch(`/api/payslips/${encodeURIComponent(id)}`, { method: "DELETE" }).then((r) =>
      json<{ ok: boolean }>(r),
    ),
  /** POST /api/recompute — ricalcolo regole categorie/interni/investimenti (report incluso). */
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
