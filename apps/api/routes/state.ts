/**
 * Route stato applicazione: transazioni, override, import/export, ricalcolo, liquidità.
 * Endpoint principali: GET/POST /state, merge transazioni, override categoria/interno/ricorrenti, migrate, recompute, export/import.
 * Tabelle: transactions, category_overrides, internal_overrides, recurring_marks; settings (loan_targets); liquidità in settings.
 * Privacy: contiene descrizioni e importi bancari dell'utente autenticato (user_id da sessione).
 */
import { Hono } from "hono";
import { getDb } from "../db";
import type { AppState, RecurringMark, Transaction } from "@shared/types";
import {
  loadAppState,
  replaceAppState,
  mergeImportIntoDb,
  setCategoryOverrideDb,
  setCategoryOverridesBulkDb,
  setInternalOverrideDb,
  setRecurringMarkDb,
} from "../lib/stateRepo";
import { recomputeDatabase } from "../lib/recomputeRepo";
import { syncKnownInvestmentContributions } from "../lib/investmentSync";
import { getSetting } from "../lib/settingsRepo";
import { loadLiquidityView, mergeLiquidityPatch } from "../lib/liquidityRepo";
import type { LiquiditySnapshots } from "@shared/lib/liquidity";
import { mergeLoanTargets } from "@shared/lib/knownLoans";
import type { LoanTarget } from "@shared/lib/loans";
import { getUserId } from "../lib/requestContext";
import type { AppEnv } from "../lib/honoTypes";

export const stateRoutes = new Hono<AppEnv>();

/** Legge i target prestito salvati in settings come JSON. */
function storedLoanTargets(
  db: ReturnType<typeof getDb>,
  userId: number,
): Record<string, LoanTarget> {
  const raw = getSetting(db, userId, "loan_targets");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, LoanTarget>;
  } catch {
    return {};
  }
}

/** GET /api/state — stato completo + vista liquidità derivata. */
stateRoutes.get("/state", (c) => {
  const userId = getUserId(c);
  const db = getDb();
  const state = loadAppState(db, userId);
  return c.json({ ...state, liquidity: loadLiquidityView(db, userId, state.transactions) });
});

/** POST /api/transactions/merge — upsert transazioni da import CSV + patch liquidità opzionale. */
stateRoutes.post("/transactions/merge", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json<{ transactions: Transaction[]; liquidity?: Partial<LiquiditySnapshots> }>();
  const db = getDb();
  const { added, updated } = mergeImportIntoDb(db, userId, body.transactions ?? []);
  if (body.liquidity && Object.keys(body.liquidity).length > 0) {
    mergeLiquidityPatch(db, userId, body.liquidity);
  }
  const investment = syncKnownInvestmentContributions(db, userId);
  const state = loadAppState(db, userId);
  return c.json({
    added,
    updated,
    investment,
    state,
    liquidity: loadLiquidityView(db, userId, state.transactions),
  });
});

/** PUT /api/overrides/category — override categoria su singola transazione. */
stateRoutes.put("/overrides/category", async (c) => {
  const userId = getUserId(c);
  const { id, category } = await c.req.json<{ id: string; category: string }>();
  const db = getDb();
  setCategoryOverrideDb(db, userId, id, category);
  return c.json(loadAppState(db, userId));
});

/** PUT /api/overrides/category/bulk — stessa categoria su più transazioni. */
stateRoutes.put("/overrides/category/bulk", async (c) => {
  const userId = getUserId(c);
  const { ids, category } = await c.req.json<{ ids: string[]; category: string }>();
  const db = getDb();
  setCategoryOverridesBulkDb(db, userId, ids ?? [], category);
  return c.json(loadAppState(db, userId));
});

/** PUT /api/overrides/internal — flag movimento interno (es. giroconti). */
stateRoutes.put("/overrides/internal", async (c) => {
  const userId = getUserId(c);
  const { id, internal } = await c.req.json<{ id: string; internal: boolean }>();
  const db = getDb();
  setInternalOverrideDb(db, userId, id, internal);
  return c.json(loadAppState(db, userId));
});

/** PUT /api/overrides/recurring — marca ricorrenza su chiave transazione. */
stateRoutes.put("/overrides/recurring", async (c) => {
  const userId = getUserId(c);
  const { key, mark } = await c.req.json<{ key: string; mark: RecurringMark }>();
  const db = getDb();
  setRecurringMarkDb(db, userId, key, mark);
  return c.json(loadAppState(db, userId));
});

/** POST /api/migrate — sostituisce stato intero se DB vuoto o force=true. */
stateRoutes.post("/migrate", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json<AppState & { force?: boolean }>();
  const db = getDb();
  const current = loadAppState(db, userId);
  if (body.force || current.transactions.length === 0) {
    const { force: _force, ...state } = body;
    replaceAppState(db, userId, state);
  }
  return c.json({ ok: true, state: loadAppState(db, userId) });
});

/** POST /api/recompute — ricalcola categorie/interni, cost_basis, sync investimenti, ri-parse PDF cedolini. */
stateRoutes.post("/recompute", async (c) => {
  const userId = getUserId(c);
  const db = getDb();
  const report = await recomputeDatabase(db, userId);
  const state = loadAppState(db, userId);
  return c.json({
    ok: true,
    state,
    loanTargets: mergeLoanTargets(storedLoanTargets(db, userId)),
    report,
    liquidity: loadLiquidityView(db, userId, state.transactions),
  });
});

/** GET /api/export — snapshot JSON versionato dello stato (senza strumenti). */
stateRoutes.get("/export", (c) => {
  const userId = getUserId(c);
  const state = loadAppState(getDb(), userId);
  return c.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    ...state,
    instruments: [],
  });
});

/** POST /api/import — replace completo stato da backup JSON. */
stateRoutes.post("/import", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json<AppState>();
  const db = getDb();
  replaceAppState(db, userId, body);
  return c.json(loadAppState(db, userId));
});
