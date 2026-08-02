import { Hono } from "hono";
import { getDb } from "../db";
import { deleteSetting, getSetting, setSetting } from "../lib/settingsRepo";

const MARKET_API_KEY = "market_api_key";

function currentSettings(db: ReturnType<typeof getDb>) {
  const key = getSetting(db, MARKET_API_KEY);
  const hasApiKey = !!key && key.trim() !== "";
  return { marketProvider: hasApiKey ? "finnhub" : "yahoo", hasApiKey };
}

export const settingsRoutes = new Hono();

settingsRoutes.get("/settings", (c) => {
  return c.json(currentSettings(getDb()));
});

settingsRoutes.put("/settings", async (c) => {
  const body = await c.req.json<{ marketApiKey?: string; clearApiKey?: boolean }>();
  const db = getDb();
  if (body.clearApiKey) {
    deleteSetting(db, MARKET_API_KEY);
  } else if (body.marketApiKey !== undefined) {
    const trimmed = body.marketApiKey.trim();
    if (trimmed === "") deleteSetting(db, MARKET_API_KEY);
    else setSetting(db, MARKET_API_KEY, trimmed);
  }
  return c.json(currentSettings(db));
});
