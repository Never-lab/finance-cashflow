import { Hono } from "hono";
import { getDb } from "../db";
import type { AppState, RecurringMark, Transaction } from "../../src/types";
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
import type { LiquiditySnapshots } from "../../src/lib/liquidity";
import { mergeLoanTargets } from "../../src/lib/knownLoans";
import type { LoanTarget } from "../../src/lib/loans";
import { getUserId } from "../lib/requestContext";
import type { AppEnv } from "../lib/honoTypes";

export const stateRoutes = new Hono<AppEnv>();

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

stateRoutes.get("/state", (c) => {
  const userId = getUserId(c);
  const db = getDb();
  const state = loadAppState(db, userId);
  return c.json({ ...state, liquidity: loadLiquidityView(db, userId, state.transactions) });
});

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

stateRoutes.put("/overrides/category", async (c) => {
  const userId = getUserId(c);
  const { id, category } = await c.req.json<{ id: string; category: string }>();
  const db = getDb();
  setCategoryOverrideDb(db, userId, id, category);
  return c.json(loadAppState(db, userId));
});

stateRoutes.put("/overrides/category/bulk", async (c) => {
  const userId = getUserId(c);
  const { ids, category } = await c.req.json<{ ids: string[]; category: string }>();
  const db = getDb();
  setCategoryOverridesBulkDb(db, userId, ids ?? [], category);
  return c.json(loadAppState(db, userId));
});

stateRoutes.put("/overrides/internal", async (c) => {
  const userId = getUserId(c);
  const { id, internal } = await c.req.json<{ id: string; internal: boolean }>();
  const db = getDb();
  setInternalOverrideDb(db, userId, id, internal);
  return c.json(loadAppState(db, userId));
});

stateRoutes.put("/overrides/recurring", async (c) => {
  const userId = getUserId(c);
  const { key, mark } = await c.req.json<{ key: string; mark: RecurringMark }>();
  const db = getDb();
  setRecurringMarkDb(db, userId, key, mark);
  return c.json(loadAppState(db, userId));
});

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

stateRoutes.post("/recompute", (c) => {
  const userId = getUserId(c);
  const db = getDb();
  const report = recomputeDatabase(db, userId);
  const state = loadAppState(db, userId);
  return c.json({
    ok: true,
    state,
    loanTargets: mergeLoanTargets(storedLoanTargets(db, userId)),
    report,
    liquidity: loadLiquidityView(db, userId, state.transactions),
  });
});

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

stateRoutes.post("/import", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json<AppState>();
  const db = getDb();
  replaceAppState(db, userId, body);
  return c.json(loadAppState(db, userId));
});
