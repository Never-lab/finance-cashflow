/**
 * Route impostazioni utente (provider mercato e API key).
 * Endpoint: GET /settings, PUT /settings (marketApiKey, clearApiKey).
 * Tabella: settings — chiave `market_api_key` (valore sensibile, non restituito in chiaro).
 */
import { Hono } from "hono";
import { getDb } from "../db";
import { deleteSetting, getSetting, setSetting } from "../lib/settingsRepo";
import { getUserId } from "../lib/requestContext";
import type { AppEnv } from "../lib/honoTypes";

const MARKET_API_KEY = "market_api_key";

/** Vista pubblica: provider dedotto e flag presenza chiave (mai il segreto). */
function currentSettings(db: ReturnType<typeof getDb>, userId: number) {
  const key = getSetting(db, userId, MARKET_API_KEY);
  const hasApiKey = !!key && key.trim() !== "";
  return { marketProvider: hasApiKey ? "finnhub" : "yahoo", hasApiKey };
}

export const settingsRoutes = new Hono<AppEnv>();

/** GET /api/settings — provider quotazioni e se esiste una API key salvata. */
settingsRoutes.get("/settings", (c) => {
  const userId = getUserId(c);
  return c.json(currentSettings(getDb(), userId));
});

/** PUT /api/settings — salva o rimuove market_api_key Finnhub. */
settingsRoutes.put("/settings", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json<{ marketApiKey?: string; clearApiKey?: boolean }>();
  const db = getDb();
  if (body.clearApiKey) {
    deleteSetting(db, userId, MARKET_API_KEY);
  } else if (body.marketApiKey !== undefined) {
    const trimmed = body.marketApiKey.trim();
    if (trimmed === "") deleteSetting(db, userId, MARKET_API_KEY);
    else setSetting(db, userId, MARKET_API_KEY, trimmed);
  }
  return c.json(currentSettings(db, userId));
});
