import { Hono } from "hono";
import { getDb } from "../db";
import { deleteSetting, getSetting, setSetting } from "../lib/settingsRepo";
import { getUserId } from "../lib/requestContext";
import type { AppEnv } from "../lib/honoTypes";
import { BUDGET_EXCLUDED_CATEGORIES, type CategoryBudgets } from "../../src/lib/budget";
import { CATEGORIES } from "../../src/lib/categorize";

const CATEGORY_BUDGETS_KEY = "category_budgets";
const ALLOWED = new Set<string>(CATEGORIES);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function readBudgets(
  db: ReturnType<typeof getDb>,
  userId: number,
): CategoryBudgets {
  const raw = getSetting(db, userId, CATEGORY_BUDGETS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: CategoryBudgets = {};
    for (const [cat, v] of Object.entries(parsed)) {
      const key = cat.trim();
      if (!ALLOWED.has(key) || BUDGET_EXCLUDED_CATEGORIES.has(key)) continue;
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[key] = round2(n);
    }
    return out;
  } catch {
    return {};
  }
}

export const budgetRoutes = new Hono<AppEnv>();

budgetRoutes.get("/budget", (c) => {
  const userId = getUserId(c);
  return c.json(readBudgets(getDb(), userId));
});

budgetRoutes.put("/budget", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json<{ category: string; limit: number | null }>();
  const category = body.category?.trim();
  if (!category) return c.json({ error: "category required" }, 400);
  if (!ALLOWED.has(category) || BUDGET_EXCLUDED_CATEGORIES.has(category)) {
    return c.json({ error: "category not allowed for budget" }, 400);
  }

  const db = getDb();
  const budgets = readBudgets(db, userId);

  if (body.limit == null) {
    delete budgets[category];
  } else {
    const n = Number(body.limit);
    if (!Number.isFinite(n) || n <= 0) {
      return c.json({ error: "limit must be a positive number" }, 400);
    }
    budgets[category] = round2(n);
  }

  if (Object.keys(budgets).length === 0) {
    deleteSetting(db, userId, CATEGORY_BUDGETS_KEY);
  } else {
    setSetting(db, userId, CATEGORY_BUDGETS_KEY, JSON.stringify(budgets));
  }

  return c.json(budgets);
});
