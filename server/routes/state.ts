import { Hono } from "hono";
import { getDb } from "../db";
import type { AppState, RecurringMark, Transaction } from "../../src/types";
import {
  loadAppState,
  replaceAppState,
  mergeImportIntoDb,
  setCategoryOverrideDb,
  setInternalOverrideDb,
  setRecurringMarkDb,
} from "../lib/stateRepo";
import { recomputeDatabase } from "../lib/recomputeRepo";
import { getSetting } from "../lib/settingsRepo";
import { mergeLoanTargets } from "../../src/lib/knownLoans";
import type { LoanTarget } from "../../src/lib/loans";

export const stateRoutes = new Hono();

function storedLoanTargets(db: ReturnType<typeof getDb>): Record<string, LoanTarget> {
  const raw = getSetting(db, "loan_targets");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, LoanTarget>;
  } catch {
    return {};
  }
}

stateRoutes.get("/state", (c) => {
  return c.json(loadAppState(getDb()));
});

stateRoutes.post("/transactions/merge", async (c) => {
  const body = await c.req.json<{ transactions: Transaction[] }>();
  const db = getDb();
  const { added, updated } = mergeImportIntoDb(db, body.transactions ?? []);
  return c.json({ added, updated, state: loadAppState(db) });
});

stateRoutes.put("/overrides/category", async (c) => {
  const { id, category } = await c.req.json<{ id: string; category: string }>();
  const db = getDb();
  setCategoryOverrideDb(db, id, category);
  return c.json(loadAppState(db));
});

stateRoutes.put("/overrides/internal", async (c) => {
  const { id, internal } = await c.req.json<{ id: string; internal: boolean }>();
  const db = getDb();
  setInternalOverrideDb(db, id, internal);
  return c.json(loadAppState(db));
});

stateRoutes.put("/overrides/recurring", async (c) => {
  const { key, mark } = await c.req.json<{ key: string; mark: RecurringMark }>();
  const db = getDb();
  setRecurringMarkDb(db, key, mark);
  return c.json(loadAppState(db));
});

stateRoutes.post("/migrate", async (c) => {
  const body = await c.req.json<AppState & { force?: boolean }>();
  const db = getDb();
  const current = loadAppState(db);
  if (body.force || current.transactions.length === 0) {
    const { force: _force, ...state } = body;
    replaceAppState(db, state);
  }
  return c.json({ ok: true, state: loadAppState(db) });
});

stateRoutes.post("/recompute", (c) => {
  const db = getDb();
  const report = recomputeDatabase(db);
  return c.json({
    ok: true,
    state: loadAppState(db),
    loanTargets: mergeLoanTargets(storedLoanTargets(db)),
    report,
  });
});

stateRoutes.get("/export", (c) => {
  const state = loadAppState(getDb());
  return c.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    ...state,
    instruments: [],
  });
});

stateRoutes.post("/import", async (c) => {
  const body = await c.req.json<AppState>();
  const db = getDb();
  replaceAppState(db, body);
  return c.json(loadAppState(db));
});
