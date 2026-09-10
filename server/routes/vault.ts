import { Hono } from "hono";
import { getDb } from "../db";
import { deleteSetting, getSetting, setSetting } from "../lib/settingsRepo";
import { getUserId } from "../lib/requestContext";
import type { AppEnv } from "../lib/honoTypes";
import type { VaultBalancesOverride, VaultId } from "../../src/lib/vaultGoals";

const VAULT_BALANCES_KEY = "vault_balances";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function readOverrides(
  db: ReturnType<typeof getDb>,
  userId: number,
): VaultBalancesOverride {
  const raw = getSetting(db, userId, VAULT_BALANCES_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: VaultBalancesOverride = {};
    for (const id of ["auto", "casa"] as const) {
      const v = parsed[id];
      if (v == null) continue;
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) out[id] = round2(n);
    }
    return out;
  } catch {
    return {};
  }
}

export const vaultRoutes = new Hono<AppEnv>();

vaultRoutes.get("/vault/balances", (c) => {
  const userId = getUserId(c);
  return c.json(readOverrides(getDb(), userId));
});

vaultRoutes.put("/vault/balances", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json<{ id: VaultId; amount: number | null }>();
  const id = body.id;
  if (id !== "auto" && id !== "casa") {
    return c.json({ error: "id must be auto or casa" }, 400);
  }

  const db = getDb();
  const overrides = readOverrides(db, userId);

  if (body.amount == null) {
    delete overrides[id];
  } else {
    const n = Number(body.amount);
    if (!Number.isFinite(n) || n < 0) {
      return c.json({ error: "amount must be a non-negative number" }, 400);
    }
    overrides[id] = round2(n);
  }

  if (Object.keys(overrides).length === 0) {
    deleteSetting(db, userId, VAULT_BALANCES_KEY);
  } else {
    setSetting(db, userId, VAULT_BALANCES_KEY, JSON.stringify(overrides));
  }

  return c.json(overrides);
});
