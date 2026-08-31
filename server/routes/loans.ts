import { Hono } from "hono";
import { getDb } from "../db";
import { deleteSetting, getSetting, setSetting } from "../lib/settingsRepo";
import type { LoanTarget } from "../../src/lib/loans";
import { mergeLoanTargets } from "../../src/lib/knownLoans";
import { getUserId } from "../lib/requestContext";
import type { AppEnv } from "../lib/honoTypes";

const LOAN_TARGETS_KEY = "loan_targets";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function readTargets(
  db: ReturnType<typeof getDb>,
  userId: number,
): Record<string, LoanTarget> {
  const raw = getSetting(db, userId, LOAN_TARGETS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, LoanTarget>;
  } catch {
    return {};
  }
}

export const loansRoutes = new Hono<AppEnv>();

loansRoutes.get("/loans/targets", (c) => {
  const userId = getUserId(c);
  return c.json(mergeLoanTargets(readTargets(getDb(), userId)));
});

loansRoutes.put("/loans/targets", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json<{ key: string; target: LoanTarget | null }>();
  const key = body.key?.trim();
  if (!key) return c.json({ error: "key required" }, 400);

  const db = getDb();
  const targets = readTargets(db, userId);
  if (body.target == null || Object.keys(body.target).length === 0) {
    delete targets[key];
  } else {
    const next: LoanTarget = {};
    if (body.target.totalInstallments != null) {
      const n = Number(body.target.totalInstallments);
      if (Number.isFinite(n) && n > 0) next.totalInstallments = Math.round(n);
    }
    if (body.target.label?.trim()) next.label = body.target.label.trim();
    if (body.target.principalAmount != null) {
      const p = Number(body.target.principalAmount);
      if (Number.isFinite(p) && p > 0) next.principalAmount = round2(p);
    }
    if (body.target.endDate?.trim()) next.endDate = body.target.endDate.trim();
    if (body.target.nextPaymentDate?.trim()) next.nextPaymentDate = body.target.nextPaymentDate.trim();
    if (body.target.startDate?.trim()) next.startDate = body.target.startDate.trim();
    if (body.target.indicativeTan != null) {
      const tan = Number(body.target.indicativeTan);
      if (Number.isFinite(tan) && tan >= 0) next.indicativeTan = round2(tan);
    }
    if (body.target.remainingDebt != null) {
      const d = Number(body.target.remainingDebt);
      if (Number.isFinite(d) && d >= 0) next.remainingDebt = round2(d);
    }
    if (body.target.totalRepaid != null) {
      const r = Number(body.target.totalRepaid);
      if (Number.isFinite(r) && r >= 0) next.totalRepaid = round2(r);
    }
    if (Object.keys(next).length === 0) delete targets[key];
    else targets[key] = next;
  }

  if (Object.keys(targets).length === 0) deleteSetting(db, userId, LOAN_TARGETS_KEY);
  else setSetting(db, userId, LOAN_TARGETS_KEY, JSON.stringify(targets));

  return c.json(mergeLoanTargets(targets));
});
