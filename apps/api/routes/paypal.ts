import { Hono } from "hono";
import { getDb } from "../db";
import { deleteSetting, getSetting, setSetting } from "../lib/settingsRepo";
import type { PaypalTarget } from "@shared/lib/paypal";
import { getUserId } from "../lib/requestContext";
import type { AppEnv } from "../lib/honoTypes";

const PAYPAL_TARGETS_KEY = "paypal_targets";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function readTargets(
  db: ReturnType<typeof getDb>,
  userId: number,
): Record<string, PaypalTarget> {
  const raw = getSetting(db, userId, PAYPAL_TARGETS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, PaypalTarget>;
  } catch {
    return {};
  }
}

export const paypalRoutes = new Hono<AppEnv>();

paypalRoutes.get("/paypal/targets", (c) => {
  const userId = getUserId(c);
  return c.json(readTargets(getDb(), userId));
});

paypalRoutes.put("/paypal/targets", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json<{ key: string; target: PaypalTarget | null }>();
  const key = body.key?.trim();
  if (!key) return c.json({ error: "key required" }, 400);

  const db = getDb();
  const targets = readTargets(db, userId);
  if (body.target == null || Object.keys(body.target).length === 0) {
    delete targets[key];
  } else {
    const next: PaypalTarget = {};
    if (body.target.remainingDebt != null) {
      const d = Number(body.target.remainingDebt);
      if (Number.isFinite(d) && d >= 0) next.remainingDebt = round2(d);
    }
    if (body.target.paidCount != null) {
      const n = Number(body.target.paidCount);
      if (Number.isFinite(n) && n >= 0) next.paidCount = Math.round(n);
    }
    if (Object.keys(next).length === 0) delete targets[key];
    else targets[key] = next;
  }

  if (Object.keys(targets).length === 0) deleteSetting(db, userId, PAYPAL_TARGETS_KEY);
  else setSetting(db, userId, PAYPAL_TARGETS_KEY, JSON.stringify(targets));

  return c.json(targets);
});

