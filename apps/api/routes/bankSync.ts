/**
 * Route Open Banking: link SCA, callback, sync, status.
 * Prefisso montaggio: `/api` → `/bank-sync/*`.
 */
import { Hono } from "hono";
import type { BankSource } from "@shared/types";
import { getDb } from "../db";
import { getBankLinkByReference } from "../lib/bankLinksRepo";
import { getUserId } from "../lib/requestContext";
import type { AppEnv } from "../lib/honoTypes";
import {
  bankSyncStatusPayload,
  finalizeBankLinkByReference,
  startBankLink,
  syncBankLinksForUser,
} from "../lib/bankSync";
import { isGoCardlessConfigured } from "../lib/gocardless";

export const bankSyncRoutes = new Hono<AppEnv>();

function isBankSource(v: unknown): v is BankSource {
  return v === "mediolanum" || v === "revolut";
}

/** GET /api/bank-sync/status — stato link per utente. */
bankSyncRoutes.get("/bank-sync/status", (c) => {
  const userId = getUserId(c);
  return c.json(bankSyncStatusPayload(getDb(), userId));
});

/** POST /api/bank-sync/link — avvia SCA; body `{ source }`. */
bankSyncRoutes.post("/bank-sync/link", async (c) => {
  if (!isGoCardlessConfigured()) {
    return c.json({ error: "Open Banking non configurato sul server" }, 503);
  }
  const userId = getUserId(c);
  const body = await c.req.json<{ source?: string }>().catch(() => ({} as { source?: string }));
  if (!isBankSource(body.source)) {
    return c.json({ error: "source deve essere mediolanum o revolut" }, 400);
  }
  try {
    const { url } = await startBankLink(getDb(), userId, body.source);
    return c.json({ url });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
});

/** POST /api/bank-sync/run — sync immediata conti collegati. */
bankSyncRoutes.post("/bank-sync/run", async (c) => {
  if (!isGoCardlessConfigured()) {
    return c.json({ error: "Open Banking non configurato sul server" }, 503);
  }
  const userId = getUserId(c);
  try {
    const { results } = await syncBankLinksForUser(getDb(), userId);
    return c.json({ results });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
});

/**
 * GET /api/bank-sync/callback — redirect banca (pubblico, no Bearer).
 * Query: `ref` = reference impostata al create requisition.
 */
bankSyncRoutes.get("/bank-sync/callback", async (c) => {
  const ref = (c.req.query("ref") || c.req.query("reference") || "").trim();
  if (!ref) {
    return c.redirect("/?bank_sync=missing_ref");
  }

  const result = await finalizeBankLinkByReference(getDb(), ref);
  if (!result.ok) {
    return c.redirect(`/?bank_sync=error&msg=${encodeURIComponent(result.error ?? "errore")}`);
  }

  const row = getBankLinkByReference(getDb(), ref);
  if (row) {
    try {
      await syncBankLinksForUser(getDb(), row.user_id);
    } catch {
      /* best-effort sync after link */
    }
  }
  return c.redirect("/?bank_sync=ok");
});
