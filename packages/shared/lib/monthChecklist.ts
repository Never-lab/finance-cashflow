/**
 * Month import checklist: bank CSV freshness + previous-month payslip present.
 */
import type { LiquidityView } from "./liquidity";
import {
  IMPORT_FRESHNESS_MAX_AGE_DAYS,
  importChecklist,
  type ImportFreshnessRow,
} from "./importFreshness";

/** Minimal payslip fields needed for checklist. */
export type PayslipPeriodRef = {
  periodYear: number;
  periodMonth: number;
};

export type PayslipChecklistRow = {
  kind: "payslip";
  ok: boolean;
  missing: boolean;
  /** Target period label MM/YYYY (previous calendar month). */
  periodLabel: string;
  periodYear: number;
  periodMonth: number;
};

export type MonthChecklistBankRow = ImportFreshnessRow & { kind: "bank" };
export type MonthChecklistRow = MonthChecklistBankRow | PayslipChecklistRow;

/** Previous calendar month relative to `now` (local). Jan → Dec prior year. */
export function previousCalendarMonth(now: Date = new Date()): {
  year: number;
  month: number;
} {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1–12
  if (m === 1) return { year: y - 1, month: 12 };
  return { year: y, month: m - 1 };
}

export function formatPeriodLabel(year: number, month: number): string {
  return `${String(month).padStart(2, "0")}/${year}`;
}

/** Ok if any payslip matches previous calendar month. */
export function payslipChecklistRow(
  payslips: PayslipPeriodRef[] | null | undefined,
  now: Date = new Date(),
): PayslipChecklistRow {
  const { year, month } = previousCalendarMonth(now);
  const periodLabel = formatPeriodLabel(year, month);
  const hit = (payslips ?? []).some((p) => p.periodYear === year && p.periodMonth === month);
  return {
    kind: "payslip",
    ok: hit,
    missing: !hit,
    periodLabel,
    periodYear: year,
    periodMonth: month,
  };
}

/** Banks (CSV freshness) + previous-month payslip. */
export function monthImportChecklist(
  liquidity: LiquidityView | null | undefined,
  payslips: PayslipPeriodRef[] | null | undefined,
  now: Date = new Date(),
  maxAgeDays: number = IMPORT_FRESHNESS_MAX_AGE_DAYS,
): MonthChecklistRow[] {
  const banks: MonthChecklistBankRow[] = importChecklist(liquidity, now, maxAgeDays).map((r) => ({
    ...r,
    kind: "bank" as const,
  }));
  return [...banks, payslipChecklistRow(payslips, now)];
}
