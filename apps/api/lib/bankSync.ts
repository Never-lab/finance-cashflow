/**
 * Orchestrazione link + sync Open Banking → mergeImportIntoDb.
 */
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { BankSource } from "@shared/types";
import { mapBookedTransactions } from "@shared/lib/mapOpenBankingTx";
import {
  getBankLink,
  getBankLinkByReference,
  listAllLinkedBankLinks,
  listBankLinks,
  markBankLinkLinked,
  markBankLinkNeedsReauth,
  updateBankLinkSyncResult,
  upsertPendingBankLink,
  type BankLinkRow,
} from "./bankLinksRepo";
import {
  createRequisition,
  getBankSyncRedirectUrl,
  getRequisition,
  isGoCardlessConfigured,
  isReauthError,
  listBookedTransactions,
  resolveInstitutionId,
} from "./gocardless";
import { mergeImportIntoDb } from "./stateRepo";

const SOURCES: BankSource[] = ["mediolanum", "revolut"];

function defaultConsentExpiry(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 90);
  return d.toISOString();
}

function dateFromForLink(link: BankLinkRow): string | undefined {
  if (link.last_sync_at) {
    // Overlap 3 days to catch late postings
    const d = new Date(link.last_sync_at);
    d.setUTCDate(d.getUTCDate() - 3);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 90);
  return d.toISOString().slice(0, 10);
}

export function bankSyncStatusPayload(db: Database.Database, userId: number) {
  const configured = isGoCardlessConfigured();
  const links = listBankLinks(db, userId).map((l) => ({
    source: l.source,
    status: l.status,
    consentExpiresAt: l.consent_expires_at,
    lastSyncAt: l.last_sync_at,
    lastError: l.last_error,
    accountCount: l.account_ids.length,
  }));
  return { configured, links };
}

/** Start SCA link; returns GoCardless hosted URL. */
export async function startBankLink(
  db: Database.Database,
  userId: number,
  source: BankSource,
): Promise<{ url: string }> {
  if (!SOURCES.includes(source)) throw new Error("source non valida");
  if (!isGoCardlessConfigured()) {
    throw new Error("Open Banking non configurato sul server");
  }

  const institutionId = await resolveInstitutionId(source);
  const reference = randomUUID();
  const baseRedirect = getBankSyncRedirectUrl();
  const sep = baseRedirect.includes("?") ? "&" : "?";
  const redirect = `${baseRedirect}${sep}ref=${encodeURIComponent(reference)}`;
  const req = await createRequisition({
    institutionId,
    redirect,
    reference,
  });

  upsertPendingBankLink(db, {
    userId,
    source,
    reference,
    requisitionId: req.id,
    institutionId,
    consentExpiresAt: defaultConsentExpiry(),
  });

  return { url: req.link };
}

/** After bank redirect: finalize accounts for reference. */
export async function finalizeBankLinkByReference(
  db: Database.Database,
  reference: string,
): Promise<{ ok: boolean; source?: BankSource; error?: string }> {
  const link = getBankLinkByReference(db, reference);
  if (!link?.requisition_id) {
    return { ok: false, error: "reference sconosciuta" };
  }

  try {
    const req = await getRequisition(link.requisition_id);
    if (req.status === "EX" || req.status === "RJ") {
      markBankLinkNeedsReauth(db, link.user_id, link.source, `Requisition ${req.status}`);
      return { ok: false, source: link.source, error: `Stato ${req.status}` };
    }
    if (req.status !== "LN" || !req.accounts?.length) {
      return { ok: false, source: link.source, error: `Collegamento incompleto (${req.status})` };
    }
    markBankLinkLinked(db, link.user_id, link.source, req.accounts, defaultConsentExpiry());
    return { ok: true, source: link.source };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    markBankLinkNeedsReauth(db, link.user_id, link.source, msg);
    return { ok: false, source: link.source, error: msg };
  }
}

export type SyncLinkResult = {
  source: BankSource;
  added: number;
  updated: number;
  error?: string;
};

async function syncOneLink(db: Database.Database, link: BankLinkRow): Promise<SyncLinkResult> {
  if (link.status === "needs_reauth") {
    return { source: link.source, added: 0, updated: 0, error: "Serve ricollegare il conto" };
  }
  if (link.status !== "linked" || !link.account_ids.length) {
    return { source: link.source, added: 0, updated: 0, error: "Conto non collegato" };
  }

  if (link.consent_expires_at && Date.parse(link.consent_expires_at) < Date.now()) {
    markBankLinkNeedsReauth(db, link.user_id, link.source, "Consenso scaduto");
    return { source: link.source, added: 0, updated: 0, error: "Consenso scaduto" };
  }

  try {
    // Refresh requisition status
    if (link.requisition_id) {
      const req = await getRequisition(link.requisition_id);
      if (req.status === "EX") {
        markBankLinkNeedsReauth(db, link.user_id, link.source, "Requisition EXPIRED");
        return { source: link.source, added: 0, updated: 0, error: "Consenso scaduto" };
      }
    }

    const dateFrom = dateFromForLink(link);
    const allRaw = [];
    for (const accountId of link.account_ids) {
      allRaw.push(...(await listBookedTransactions(accountId, dateFrom)));
    }
    const mapped = mapBookedTransactions(allRaw, link.source);
    const { added, updated } = mergeImportIntoDb(db, link.user_id, mapped);
    const lastSyncAt = new Date().toISOString();
    updateBankLinkSyncResult(db, link.user_id, link.source, { ok: true, lastSyncAt });
    return { source: link.source, added, updated };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    updateBankLinkSyncResult(db, link.user_id, link.source, {
      ok: false,
      error: msg,
      needsReauth: isReauthError(e),
    });
    return { source: link.source, added: 0, updated: 0, error: msg };
  }
}

/** Sync all linked banks for one user. */
export async function syncBankLinksForUser(
  db: Database.Database,
  userId: number,
): Promise<{ results: SyncLinkResult[] }> {
  const links = listBankLinks(db, userId).filter(
    (l) => l.status === "linked" || l.status === "error",
  );
  const results: SyncLinkResult[] = [];
  for (const link of links) {
    // Re-read in case status changed
    const fresh = getBankLink(db, userId, link.source);
    if (!fresh) continue;
    results.push(await syncOneLink(db, fresh));
  }
  return { results };
}

/** Cron: sync every linked row across users. */
export async function syncAllLinkedUsers(db: Database.Database): Promise<void> {
  const links = listAllLinkedBankLinks(db);
  const byUser = new Map<number, BankLinkRow[]>();
  for (const l of links) {
    const arr = byUser.get(l.user_id) ?? [];
    arr.push(l);
    byUser.set(l.user_id, arr);
  }
  for (const [userId] of byUser) {
    await syncBankLinksForUser(db, userId);
  }
}
