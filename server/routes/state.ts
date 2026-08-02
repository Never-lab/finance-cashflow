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

export const stateRoutes = new Hono();

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
