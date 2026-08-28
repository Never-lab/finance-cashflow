import type { Transaction } from "../types";

export const PAYSLIP_PARSER_VERSION = "osra-oluit-1";

export type PayslipLeave = {
  spettanti: number | null;
  godute: number | null;
  residue: number | null;
};

export type PayslipRecord = {
  id: string;
  periodYear: number;
  periodMonth: number;
  periodLabel: string;
  payDate: string | null;
  grossTotal: number | null;
  taxableIncome: number | null;
  taxWithheld: number | null;
  taxWithheldNet: number | null;
  socialWithheld: number | null;
  netToAccount: number | null;
  totalCompetenze: number | null;
  netPay: number | null;
  bankCredit: number | null;
  leaveFest: PayslipLeave;
  leaveFerie: PayslipLeave;
  leavePerm: PayslipLeave;
  sourceFile: string | null;
  importedAt: string;
  parserVersion: string;
};

export type PayslipSummary = {
  payslips: PayslipRecord[];
  latest: PayslipRecord | null;
  avgNet6: number | null;
  avgGross6: number | null;
  chartNet: { period: string; netPay: number; grossTotal: number | null; bankCredit: number | null }[];
  chartLeave: {
    period: string;
    ferieResidue: number | null;
    permResidui: number | null;
  }[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Italian payslip amount: 2.407,43 → 2407.43 */
export function parseItalianAmount(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  if (!s || s === "—" || s === "-") return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? round2(n) : null;
}

function slugLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseItDate(raw: string): string | null {
  const m = raw.trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function amt(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern);
  return m?.[1] ? parseItalianAmount(m[1]) : null;
}

function leaveTriplet(a: string | undefined, b: string | undefined, c: string | undefined): PayslipLeave {
  return {
    spettanti: a ? parseItalianAmount(a) : null,
    godute: b ? parseItalianAmount(b) : null,
    residue: c ? parseItalianAmount(c) : null,
  };
}

/** Parse OSRA / Wolters Kluwer OLUIT payslip text (AFEA / ITWorking). */
export function parseOsraPayslipText(text: string, sourceFile?: string): PayslipRecord | null {
  if (!/OSRA|OLUIT|Wolters Kluwer/i.test(text)) return null;

  const period = text.match(/(\d{2})\/(\d{4})\s*-\s*(\S+)/);
  if (!period) return null;

  const periodMonthRaw = Number(period[1]);
  const periodYear = Number(period[2]);
  const periodLabel = period[3]!;
  const periodMonth = /tredicesima/i.test(periodLabel) ? 13 : periodMonthRaw;
  if (periodMonthRaw < 1 || periodMonthRaw > 12) return null;
  if (periodMonth !== 13 && (periodMonth < 1 || periodMonth > 12)) return null;

  const grossTotal = amt(text, /999 TOT\.LORDO SOGG\.CONTR\s+([\d.,]+)/);
  const taxableIncome = amt(text, /Imponibile Fiscale\s+([\d.,]+)/);
  const taxWithheld = amt(text, /Rit\. Fis\. mese lorda\s+([\d.,]+)/);
  const taxWithheldNet = amt(text, /Rit\. Fis\. mese netta\s+([\d.,]+)/);
  const socialWithheld = amt(text, /Tot\. rit\. sociali\s+([\d.,]+)/);

  const acc = text.match(
    /Acc\.\s*c\.c\. n\.:\s*\d+\s+BANCA MEDIOLANUM[^\d]*([\d.,]+)\s+([\d.,]+)/i,
  );
  const netToAccount = acc?.[1] ? parseItalianAmount(acc[1]) : null;
  const totalCompetenze = acc?.[2] ? parseItalianAmount(acc[2]) : null;

  const payDate = parseItDate(text.match(/Data valuta\s*:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? "");

  let leaveFest = leaveTriplet(undefined, undefined, undefined);
  let leaveFerie = leaveTriplet(undefined, undefined, undefined);
  let leavePerm = leaveTriplet(undefined, undefined, undefined);

  const grid = text.match(
    /(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*\nCodice CNEL/i,
  );
  if (grid) {
    leaveFest = leaveTriplet(grid[1], grid[2], grid[3]);
    leaveFerie = leaveTriplet(grid[4], grid[5], grid[6]);
    leavePerm = leaveTriplet(grid[7], grid[8], grid[9]);
  }

  const residuo = text.match(
    /Residuo\s*:\s*([\d.,]+)\s+Residuo\s*:\s*([\d.,]+)\s+Residuo\s*:\s*([\d.,]+)/i,
  );
  if (residuo) {
    leaveFest.residue = parseItalianAmount(residuo[1]!);
    leaveFerie.residue = parseItalianAmount(residuo[2]!);
    leavePerm.residue = parseItalianAmount(residuo[3]!);
  }

  let netPay: number | null = netToAccount;
  if (netPay == null && taxableIncome != null && taxWithheld != null && socialWithheld != null) {
    netPay = round2(taxableIncome - taxWithheld - socialWithheld);
  }

  const id = `osra-${periodYear}-${String(periodMonth).padStart(2, "0")}-${slugLabel(periodLabel)}`;

  return {
    id,
    periodYear,
    periodMonth,
    periodLabel,
    payDate,
    grossTotal,
    taxableIncome,
    taxWithheld,
    taxWithheldNet,
    socialWithheld,
    netToAccount,
    totalCompetenze,
    netPay,
    bankCredit: null,
    leaveFest,
    leaveFerie,
    leavePerm,
    sourceFile: sourceFile ?? null,
    importedAt: new Date().toISOString(),
    parserVersion: PAYSLIP_PARSER_VERSION,
  };
}

/** Match Mediolanum stipendio credit for payslip month. */
export function matchBankCredit(
  transactions: Transaction[],
  periodYear: number,
  periodMonth: number,
): number | null {
  const prefix = `${periodYear}-${String(periodMonth).padStart(2, "0")}`;
  const hits = transactions.filter(
    (t) =>
      t.source === "mediolanum" &&
      t.amount > 0 &&
      t.date.startsWith(prefix) &&
      (t.category === "Stipendio" || /emolument|stipend|sala stipend/i.test(t.description)),
  );
  if (hits.length === 0) return null;
  return round2(hits.reduce((s, t) => s + t.amount, 0));
}

export function enrichPayslipWithBank(payslip: PayslipRecord, transactions: Transaction[]): PayslipRecord {
  const bankCredit = matchBankCredit(transactions, payslip.periodYear, payslip.periodMonth);
  const netPay = bankCredit ?? payslip.netPay;
  return { ...payslip, bankCredit, netPay };
}

function periodKey(p: PayslipRecord): string {
  return `${p.periodYear}-${String(p.periodMonth).padStart(2, "0")}`;
}

export function buildPayslipSummary(
  payslips: PayslipRecord[],
  transactions: Transaction[] = [],
): PayslipSummary {
  const enriched = payslips
    .map((p) => enrichPayslipWithBank(p, transactions))
    .sort((a, b) => periodKey(a).localeCompare(periodKey(b)) || a.periodLabel.localeCompare(b.periodLabel));

  const latest = enriched.at(-1) ?? null;
  const last6 = enriched.filter((p) => p.netPay != null).slice(-6);
  const avgNet6 =
    last6.length > 0 ? round2(last6.reduce((s, p) => s + (p.netPay ?? 0), 0) / last6.length) : null;
  const gross6 = last6.filter((p) => p.grossTotal != null);
  const avgGross6 =
    gross6.length > 0
      ? round2(gross6.reduce((s, p) => s + (p.grossTotal ?? 0), 0) / gross6.length)
      : null;

  return {
    payslips: enriched,
    latest,
    avgNet6,
    avgGross6,
    chartNet: enriched.map((p) => ({
      period: `${String(p.periodMonth).padStart(2, "0")}/${p.periodYear}`,
      netPay: p.netPay ?? 0,
      grossTotal: p.grossTotal,
      bankCredit: p.bankCredit,
    })),
    chartLeave: enriched.map((p) => ({
      period: `${String(p.periodMonth).padStart(2, "0")}/${p.periodYear}`,
      ferieResidue: p.leaveFerie.residue ?? p.leaveFerie.spettanti,
      permResidui: p.leavePerm.residue ?? p.leavePerm.spettanti,
    })),
  };
}
