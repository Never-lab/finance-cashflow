import { Hono } from "hono";
import { getDb } from "../db";
import { deleteSetting, getSetting, setSetting } from "../lib/settingsRepo";
import { getUserId } from "../lib/requestContext";
import type { AppEnv } from "../lib/honoTypes";

const MARKET_API_KEY = "market_api_key";

function currentSettings(db: ReturnType<typeof getDb>, userId: number) {
  const key = getSetting(db, userId, MARKET_API_KEY);
  const hasApiKey = !!key && key.trim() !== "";
  return { marketProvider: hasApiKey ? "finnhub" : "yahoo", hasApiKey };
}

export const settingsRoutes = new Hono<AppEnv>();

settingsRoutes.get("/settings", (c) => {
  const userId = getUserId(c);
  return c.json(currentSettings(getDb(), userId));
});

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
