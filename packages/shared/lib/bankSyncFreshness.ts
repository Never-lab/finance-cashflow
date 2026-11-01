/**
 * Freshness checks for Open Banking links + txn data age (UI stale alerts).
 */
import { ageDaysFromRef } from "./importFreshness";

/** lastSync older than this, or consent within this window → warn. */
export const BANK_LINK_STALE_DAYS = 14;
/** Newest txn older than this (or empty) → «CSV/sync vecchio». */
export const TXN_DATA_STALE_DAYS = 21;

export type BankLinkFreshnessInput = {
  status?: string;
  lastSyncAt: string | null;
  consentExpiresAt: string | null;
};

export type BankLinkAttention = {
  staleSync: boolean;
  consentExpiring: boolean;
};

/** True if linked (or had sync) and sync/consent need attention. */
export function bankLinkNeedsAttention(
  link: BankLinkFreshnessInput,
  now: Date = new Date(),
  staleDays: number = BANK_LINK_STALE_DAYS,
): BankLinkAttention {
  const active =
    link.status === "linked" ||
    link.status === "needs_reauth" ||
    link.status === "error" ||
    Boolean(link.lastSyncAt);

  if (!active) return { staleSync: false, consentExpiring: false };

  let staleSync = false;
  if (!link.lastSyncAt) {
    staleSync = link.status === "linked";
  } else {
    const age = ageDaysFromRef(link.lastSyncAt, now);
    staleSync = age != null && age > staleDays;
  }

  let consentExpiring = false;
  if (link.consentExpiresAt) {
    const msLeft = Date.parse(link.consentExpiresAt) - now.getTime();
    if (!Number.isNaN(msLeft)) {
      consentExpiring = msLeft / 86_400_000 <= staleDays;
    }
  }

  return { staleSync, consentExpiring };
}

/** Italian muted warning, or null if all ok. */
export function bankLinksStaleMessage(
  links: BankLinkFreshnessInput[],
  now: Date = new Date(),
  staleDays: number = BANK_LINK_STALE_DAYS,
): string | null {
  let staleSync = false;
  let consentExpiring = false;
  for (const link of links) {
    const a = bankLinkNeedsAttention(link, now, staleDays);
    if (a.staleSync) staleSync = true;
    if (a.consentExpiring) consentExpiring = true;
  }
  if (!staleSync && !consentExpiring) return null;
  if (staleSync && consentExpiring) {
    return "Sync bancaria vecchia (>14 giorni) e consenso in scadenza — sincronizza o ricollega.";
  }
  if (staleSync) {
    return "Ultima sync bancaria più vecchia di 14 giorni — sincronizza o ricollega.";
  }
  return "Consenso Open Banking in scadenza entro 14 giorni — ricollega il conto.";
}

/** Empty list or newest `YYYY-MM-DD` older than maxAgeDays. */
export function isTransactionDataStale(
  dates: readonly string[],
  now: Date = new Date(),
  maxAgeDays: number = TXN_DATA_STALE_DAYS,
): boolean {
  if (dates.length === 0) return true;
  let newest = dates[0]!;
  for (let i = 1; i < dates.length; i++) {
    const d = dates[i]!;
    if (d > newest) newest = d;
  }
  const age = ageDaysFromRef(newest, now);
  return age == null || age > maxAgeDays;
}
