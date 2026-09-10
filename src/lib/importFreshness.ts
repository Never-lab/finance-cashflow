import type { BankSource } from "../types";
import type {
  MediolanumBalanceSnapshot,
  RevolutBalanceSnapshot,
  LiquidityView,
} from "./liquidity";

export const IMPORT_FRESHNESS_MAX_AGE_DAYS = 35;

export type ImportFreshnessRow = {
  source: BankSource;
  ok: boolean;
  missing: boolean;
  asOf: string | null;
  ageDays: number | null;
};

type BalanceSnap = Pick<
  MediolanumBalanceSnapshot | RevolutBalanceSnapshot,
  "asOf" | "importedAt"
>;

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole local calendar days between snapshot date and now (0 = same calendar day). */
export function ageDaysFromRef(refIso: string, now: Date): number | null {
  const day = refIso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const snapMs = new Date(y, m - 1, d).getTime();
  const nowMs = startOfLocalDay(now);
  return Math.floor((nowMs - snapMs) / 86_400_000);
}

function refDate(snap: BalanceSnap): string | null {
  const asOf = snap.asOf?.trim();
  if (asOf) return asOf;
  const imported = snap.importedAt?.trim();
  if (imported) return imported;
  return null;
}

export function bankImportFreshness(
  source: BankSource,
  snap: BalanceSnap | null | undefined,
  now: Date = new Date(),
  maxAgeDays: number = IMPORT_FRESHNESS_MAX_AGE_DAYS,
): ImportFreshnessRow {
  if (!snap) {
    return { source, ok: false, missing: true, asOf: null, ageDays: null };
  }
  const ref = refDate(snap);
  if (!ref) {
    return { source, ok: false, missing: true, asOf: null, ageDays: null };
  }
  const ageDays = ageDaysFromRef(ref, now);
  if (ageDays == null) {
    return { source, ok: false, missing: true, asOf: null, ageDays: null };
  }
  const age = Math.max(0, ageDays);
  const asOf = snap.asOf?.trim() || ref.slice(0, 10);
  return {
    source,
    ok: age <= maxAgeDays,
    missing: false,
    asOf: asOf.slice(0, 10),
    ageDays: age,
  };
}

export function importChecklist(
  liquidity: LiquidityView | null | undefined,
  now: Date = new Date(),
  maxAgeDays: number = IMPORT_FRESHNESS_MAX_AGE_DAYS,
): ImportFreshnessRow[] {
  return [
    bankImportFreshness("mediolanum", liquidity?.mediolanum ?? null, now, maxAgeDays),
    bankImportFreshness("revolut", liquidity?.revolut ?? null, now, maxAgeDays),
  ];
}
