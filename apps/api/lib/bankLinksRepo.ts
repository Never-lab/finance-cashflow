/**
 * Persistenza collegamenti Open Banking (GoCardless) per utente/banca.
 */
import type Database from "better-sqlite3";
import type { BankSource } from "@shared/types";

export type BankLinkStatus = "pending" | "linked" | "needs_reauth" | "error";

export type BankLinkRow = {
  user_id: number;
  source: BankSource;
  requisition_id: string | null;
  reference: string;
  institution_id: string | null;
  account_ids: string[];
  status: BankLinkStatus;
  consent_expires_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type DbRow = {
  user_id: number;
  source: string;
  requisition_id: string | null;
  reference: string;
  institution_id: string | null;
  account_ids: string;
  status: string;
  consent_expires_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

function parseAccounts(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function fromDb(row: DbRow): BankLinkRow {
  return {
    user_id: row.user_id,
    source: row.source as BankSource,
    requisition_id: row.requisition_id,
    reference: row.reference,
    institution_id: row.institution_id,
    account_ids: parseAccounts(row.account_ids),
    status: row.status as BankLinkStatus,
    consent_expires_at: row.consent_expires_at,
    last_sync_at: row.last_sync_at,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function getBankLink(
  db: Database.Database,
  userId: number,
  source: BankSource,
): BankLinkRow | null {
  const row = db
    .prepare(`SELECT * FROM bank_links WHERE user_id = ? AND source = ?`)
    .get(userId, source) as DbRow | undefined;
  return row ? fromDb(row) : null;
}

export function getBankLinkByReference(db: Database.Database, reference: string): BankLinkRow | null {
  const row = db.prepare(`SELECT * FROM bank_links WHERE reference = ?`).get(reference) as
    | DbRow
    | undefined;
  return row ? fromDb(row) : null;
}

export function listBankLinks(db: Database.Database, userId: number): BankLinkRow[] {
  const rows = db
    .prepare(`SELECT * FROM bank_links WHERE user_id = ? ORDER BY source`)
    .all(userId) as DbRow[];
  return rows.map(fromDb);
}

export function listAllLinkedBankLinks(db: Database.Database): BankLinkRow[] {
  const rows = db
    .prepare(`SELECT * FROM bank_links WHERE status = 'linked'`)
    .all() as DbRow[];
  return rows.map(fromDb);
}

/** Create or replace pending link before redirecting user to bank SCA. */
export function upsertPendingBankLink(
  db: Database.Database,
  input: {
    userId: number;
    source: BankSource;
    reference: string;
    requisitionId: string;
    institutionId: string;
    consentExpiresAt: string | null;
  },
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO bank_links (
      user_id, source, requisition_id, reference, institution_id, account_ids,
      status, consent_expires_at, last_sync_at, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, '[]', 'pending', ?, NULL, NULL, ?, ?)
    ON CONFLICT(user_id, source) DO UPDATE SET
      requisition_id = excluded.requisition_id,
      reference = excluded.reference,
      institution_id = excluded.institution_id,
      account_ids = '[]',
      status = 'pending',
      consent_expires_at = excluded.consent_expires_at,
      last_error = NULL,
      updated_at = excluded.updated_at`,
  ).run(
    input.userId,
    input.source,
    input.requisitionId,
    input.reference,
    input.institutionId,
    input.consentExpiresAt,
    now,
    now,
  );
}

export function markBankLinkLinked(
  db: Database.Database,
  userId: number,
  source: BankSource,
  accountIds: string[],
  consentExpiresAt: string | null,
): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE bank_links SET
      account_ids = ?,
      status = 'linked',
      consent_expires_at = ?,
      last_error = NULL,
      updated_at = ?
     WHERE user_id = ? AND source = ?`,
  ).run(JSON.stringify(accountIds), consentExpiresAt, now, userId, source);
}

export function markBankLinkNeedsReauth(
  db: Database.Database,
  userId: number,
  source: BankSource,
  error: string,
): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE bank_links SET status = 'needs_reauth', last_error = ?, updated_at = ?
     WHERE user_id = ? AND source = ?`,
  ).run(error, now, userId, source);
}

export function updateBankLinkSyncResult(
  db: Database.Database,
  userId: number,
  source: BankSource,
  result: { ok: true; lastSyncAt: string } | { ok: false; error: string; needsReauth?: boolean },
): void {
  const now = new Date().toISOString();
  if (result.ok) {
    db.prepare(
      `UPDATE bank_links SET last_sync_at = ?, last_error = NULL, status = 'linked', updated_at = ?
       WHERE user_id = ? AND source = ?`,
    ).run(result.lastSyncAt, now, userId, source);
    return;
  }
  const status = result.needsReauth ? "needs_reauth" : "error";
  db.prepare(
    `UPDATE bank_links SET status = ?, last_error = ?, updated_at = ?
     WHERE user_id = ? AND source = ?`,
  ).run(status, result.error, now, userId, source);
}
