import { describe, expect, it } from "vitest";
import {
  formatPeriodLabel,
  monthImportChecklist,
  payslipChecklistRow,
  previousCalendarMonth,
} from "./monthChecklist";
import type { LiquidityView } from "./liquidity";

describe("previousCalendarMonth", () => {
  it("rolls Jan to Dec prior year", () => {
    expect(previousCalendarMonth(new Date(2026, 0, 15))).toEqual({ year: 2025, month: 12 });
  });

  it("returns prior month within year", () => {
    expect(previousCalendarMonth(new Date(2026, 8, 22))).toEqual({ year: 2026, month: 8 });
  });
});

describe("payslipChecklistRow", () => {
  const now = new Date(2026, 8, 22); // Sep 2026 → need Aug 2026

  it("ok when previous month present", () => {
    const row = payslipChecklistRow([{ periodYear: 2026, periodMonth: 8 }], now);
    expect(row.ok).toBe(true);
    expect(row.missing).toBe(false);
    expect(row.periodLabel).toBe("08/2026");
  });

  it("missing when only current month", () => {
    const row = payslipChecklistRow([{ periodYear: 2026, periodMonth: 9 }], now);
    expect(row.ok).toBe(false);
    expect(row.missing).toBe(true);
  });

  it("missing when empty", () => {
    expect(payslipChecklistRow([], now).ok).toBe(false);
    expect(payslipChecklistRow(null, now).ok).toBe(false);
  });
});

describe("monthImportChecklist", () => {
  it("appends payslip after two banks", () => {
    const now = new Date(2026, 8, 22);
    const liq: LiquidityView = {
      mediolanum: {
        ledger: 1000,
        available: 1000,
        asOf: "2026-09-20",
        importedAt: "2026-09-20T10:00:00Z",
      },
      revolut: {
        attuale: 200,
        risparmi: 100,
        deposito: 50,
        pendingAttuale: 0,
        asOf: "2026-09-20",
        importedAt: "2026-09-20T10:00:00Z",
      },
      revolutAttualeEffective: 200,
      pockets: null,
      totalEur: 1350,
      note: null,
    };
    const rows = monthImportChecklist(liq, [{ periodYear: 2026, periodMonth: 8 }], now);
    expect(rows).toHaveLength(3);
    expect(rows[0].kind).toBe("bank");
    expect(rows[1].kind).toBe("bank");
    expect(rows[2]).toMatchObject({ kind: "payslip", ok: true, periodLabel: "08/2026" });
  });

  it("formatPeriodLabel pads month", () => {
    expect(formatPeriodLabel(2026, 3)).toBe("03/2026");
  });
});
