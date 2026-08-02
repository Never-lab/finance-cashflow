import { Hono } from "hono";
import { getDb } from "../db";
import type { Contribution, Holding, Instrument } from "../../src/types";
import {
  addContribution,
  deleteContribution,
  deleteInstrument,
  getHolding,
  getInstrument,
  linkTransaction,
  listContributions,
  listInstruments,
  upsertHolding,
  upsertInstrument,
} from "../lib/instrumentsRepo";

export const instrumentsRoutes = new Hono();

instrumentsRoutes.get("/instruments", (c) => {
  const db = getDb();
  const instruments = listInstruments(db).map((instrument) => ({
    ...instrument,
    holding: getHolding(db, instrument.id) ?? null,
  }));
  return c.json(instruments);
});

instrumentsRoutes.post("/instruments", async (c) => {
  const body = await c.req.json<Partial<Instrument>>();
  const db = getDb();
  const now = new Date().toISOString();
  const instrument: Instrument = {
    id: body.id ?? crypto.randomUUID(),
    name: body.name ?? "",
    type: (body.type ?? "etf") as Instrument["type"],
    ticker: body.ticker ?? null,
    isin: body.isin ?? null,
    currency: body.currency ?? "EUR",
    notes: body.notes ?? null,
    createdAt: body.createdAt ?? now,
    updatedAt: now,
  };
  upsertInstrument(db, instrument);
  return c.json(instrument, 201);
});

instrumentsRoutes.patch("/instruments/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb();
  const existing = getInstrument(db, id);
  if (!existing) return c.json({ error: "not found" }, 404);
  const body = await c.req.json<Partial<Instrument>>();
  const updated: Instrument = {
    ...existing,
    ...body,
    id,
    updatedAt: new Date().toISOString(),
  };
  upsertInstrument(db, updated);
  return c.json(updated);
});

instrumentsRoutes.delete("/instruments/:id", (c) => {
  deleteInstrument(getDb(), c.req.param("id"));
  return c.json({ ok: true });
});

instrumentsRoutes.put("/instruments/:id/holding", async (c) => {
  const instrumentId = c.req.param("id");
  const db = getDb();
  const body = await c.req.json<Partial<Holding>>();
  const current = getHolding(db, instrumentId);
  const holding: Holding = {
    instrumentId,
    quantity: body.quantity ?? current?.quantity ?? null,
    cashBalance: body.cashBalance ?? current?.cashBalance ?? null,
    costBasis: body.costBasis ?? current?.costBasis ?? 0,
    asOf: body.asOf ?? current?.asOf ?? null,
  };
  upsertHolding(db, holding);
  return c.json(getHolding(db, instrumentId));
});

instrumentsRoutes.get("/instruments/:id/contributions", (c) => {
  return c.json(listContributions(getDb(), c.req.param("id")));
});

instrumentsRoutes.post("/instruments/:id/contributions", async (c) => {
  const instrumentId = c.req.param("id");
  const body = await c.req.json<Partial<Contribution>>();
  const db = getDb();
  const contribution: Contribution = {
    id: body.id ?? crypto.randomUUID(),
    instrumentId,
    date: body.date ?? new Date().toISOString().slice(0, 10),
    amount: body.amount ?? 0,
    transactionId: body.transactionId ?? null,
    note: body.note ?? null,
  };
  addContribution(db, contribution);
  return c.json(contribution, 201);
});

instrumentsRoutes.delete("/contributions/:id", (c) => {
  deleteContribution(getDb(), c.req.param("id"));
  return c.json({ ok: true });
});

instrumentsRoutes.post("/instruments/:id/link-transaction", async (c) => {
  const instrumentId = c.req.param("id");
  const { transactionId } = await c.req.json<{ transactionId: string }>();
  const db = getDb();
  try {
    const contribution = linkTransaction(db, instrumentId, transactionId);
    return c.json(contribution, 201);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});
