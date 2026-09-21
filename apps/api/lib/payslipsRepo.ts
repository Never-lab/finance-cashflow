/**
 * Repository cedolini OSRA/OLUIT persistiti in SQLite.
 * Ruolo: repo — tabella payslips (campi retributivi e ferie/permessi).
 * Privacy: contiene importi lordi/netti e residui ferie per user_id.
 */
import type Database from "better-sqlite3";
import type { BankMatchStatus, PayslipLeave, PayslipRecord } from "@shared/lib/payslip";
import { buildLeave, resolvePayslipNet } from "@shared/lib/payslip";

type Row = {
  id: string;
  period_year: number;
  period_month: number;
  period_label: string;
  pay_date: string | null;
  gross_total: number | null;
  taxable_income: number | null;
  tax_withheld: number | null;
  tax_withheld_net: number | null;
  social_withheld: number | null;
  net_to_account: number | null;
  total_competenze: number | null;
  payslip_net: number | null;
  net_pay: number | null;
  bank_credit: number | null;
  bank_match_status: string | null;
  acc_anomalous: number | null;
  leave_fest_ap_s: number | null;
  leave_fest_ap_g: number | null;
  leave_fest_ap_r: number | null;
  leave_fest_ac_s: number | null;
  leave_fest_ac_g: number | null;
  leave_fest_ac_r: number | null;
  leave_fest_s: number | null;
  leave_fest_g: number | null;
  leave_fest_r: number | null;
  leave_ferie_ap_s: number | null;
  leave_ferie_ap_g: number | null;
  leave_ferie_ap_r: number | null;
  leave_ferie_ac_s: number | null;
  leave_ferie_ac_g: number | null;
  leave_ferie_ac_r: number | null;
  leave_ferie_s: number | null;
  leave_ferie_g: number | null;
  leave_ferie_r: number | null;
  leave_perm_ap_s: number | null;
  leave_perm_ap_g: number | null;
  leave_perm_ap_r: number | null;
  leave_perm_ac_s: number | null;
  leave_perm_ac_g: number | null;
  leave_perm_ac_r: number | null;
  leave_perm_s: number | null;
  leave_perm_g: number | null;
  leave_perm_r: number | null;
  source_file: string | null;
  imported_at: string;
  parser_version: string;
};

function sliceFromRow(
  apS: number | null,
  apG: number | null,
  apR: number | null,
  acS: number | null,
  acG: number | null,
  acR: number | null,
  totalS: number | null,
  totalG: number | null,
  totalR: number | null,
): PayslipLeave {
  const hasApAc = apS != null || apG != null || apR != null || acS != null || acG != null || acR != null;
  if (hasApAc) {
    return buildLeave(
      { spettanti: apS, godute: apG, residue: apR },
      { spettanti: acS, godute: acG, residue: acR },
    );
  }
  return buildLeave({ spettanti: totalS, godute: totalG, residue: totalR });
}

function leaveFromRow(
  apS: number | null | undefined,
  apG: number | null | undefined,
  apR: number | null | undefined,
  acS: number | null | undefined,
  acG: number | null | undefined,
  acR: number | null | undefined,
  totalS: number | null,
  totalG: number | null,
  totalR: number | null,
): PayslipLeave {
  return sliceFromRow(
    apS ?? null,
    apG ?? null,
    apR ?? null,
    acS ?? null,
    acG ?? null,
    acR ?? null,
    totalS,
    totalG,
    totalR,
  );
}

function parseMatchStatus(raw: string | null): BankMatchStatus {
  if (raw === "matched" || raw === "doubt" || raw === "missing") return raw;
  return "missing";
}

function rowToRecord(row: Row): PayslipRecord {
  const resolved =
    row.payslip_net != null
      ? { payslipNet: row.payslip_net, accAnomalous: Boolean(row.acc_anomalous) }
      : resolvePayslipNet({
          netToAccount: row.net_to_account,
          taxableIncome: row.taxable_income,
          taxWithheld: row.tax_withheld,
          socialWithheld: row.social_withheld,
        });

  return {
    id: row.id,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    periodLabel: row.period_label,
    payDate: row.pay_date,
    grossTotal: row.gross_total,
    taxableIncome: row.taxable_income,
    taxWithheld: row.tax_withheld,
    taxWithheldNet: row.tax_withheld_net,
    socialWithheld: row.social_withheld,
    netToAccount: row.net_to_account,
    totalCompetenze: row.total_competenze,
    payslipNet: resolved.payslipNet,
    netPay: row.net_pay ?? resolved.payslipNet,
    bankCredit: row.bank_credit,
    bankMatchStatus: parseMatchStatus(row.bank_match_status),
    accAnomalous: resolved.accAnomalous,
    leaveFest: leaveFromRow(
      row.leave_fest_ap_s,
      row.leave_fest_ap_g,
      row.leave_fest_ap_r,
      row.leave_fest_ac_s,
      row.leave_fest_ac_g,
      row.leave_fest_ac_r,
      row.leave_fest_s,
      row.leave_fest_g,
      row.leave_fest_r,
    ),
    leaveFerie: leaveFromRow(
      row.leave_ferie_ap_s,
      row.leave_ferie_ap_g,
      row.leave_ferie_ap_r,
      row.leave_ferie_ac_s,
      row.leave_ferie_ac_g,
      row.leave_ferie_ac_r,
      row.leave_ferie_s,
      row.leave_ferie_g,
      row.leave_ferie_r,
    ),
    leavePerm: leaveFromRow(
      row.leave_perm_ap_s,
      row.leave_perm_ap_g,
      row.leave_perm_ap_r,
      row.leave_perm_ac_s,
      row.leave_perm_ac_g,
      row.leave_perm_ac_r,
      row.leave_perm_s,
      row.leave_perm_g,
      row.leave_perm_r,
    ),
    sourceFile: row.source_file,
    importedAt: row.imported_at,
    parserVersion: row.parser_version,
  };
}

function leaveParams(prefix: "leave_ferie" | "leave_perm" | "leave_fest", leave: PayslipLeave): Record<string, number | null> {
  return {
    [`${prefix}_ap_s`]: leave.ap.spettanti,
    [`${prefix}_ap_g`]: leave.ap.godute,
    [`${prefix}_ap_r`]: leave.ap.residue,
    [`${prefix}_ac_s`]: leave.ac.spettanti,
    [`${prefix}_ac_g`]: leave.ac.godute,
    [`${prefix}_ac_r`]: leave.ac.residue,
    [`${prefix}_s`]: leave.spettanti,
    [`${prefix}_g`]: leave.godute,
    [`${prefix}_r`]: leave.residue,
  };
}

const UPSERT = `
INSERT INTO payslips (
  user_id, id, period_year, period_month, period_label, pay_date,
  gross_total, taxable_income, tax_withheld, tax_withheld_net, social_withheld,
  net_to_account, total_competenze, payslip_net, net_pay, bank_credit,
  bank_match_status, acc_anomalous,
  leave_fest_ap_s, leave_fest_ap_g, leave_fest_ap_r,
  leave_fest_ac_s, leave_fest_ac_g, leave_fest_ac_r,
  leave_fest_s, leave_fest_g, leave_fest_r,
  leave_ferie_ap_s, leave_ferie_ap_g, leave_ferie_ap_r,
  leave_ferie_ac_s, leave_ferie_ac_g, leave_ferie_ac_r,
  leave_ferie_s, leave_ferie_g, leave_ferie_r,
  leave_perm_ap_s, leave_perm_ap_g, leave_perm_ap_r,
  leave_perm_ac_s, leave_perm_ac_g, leave_perm_ac_r,
  leave_perm_s, leave_perm_g, leave_perm_r,
  source_file, imported_at, parser_version
) VALUES (
  @user_id, @id, @period_year, @period_month, @period_label, @pay_date,
  @gross_total, @taxable_income, @tax_withheld, @tax_withheld_net, @social_withheld,
  @net_to_account, @total_competenze, @payslip_net, @net_pay, @bank_credit,
  @bank_match_status, @acc_anomalous,
  @leave_fest_ap_s, @leave_fest_ap_g, @leave_fest_ap_r,
  @leave_fest_ac_s, @leave_fest_ac_g, @leave_fest_ac_r,
  @leave_fest_s, @leave_fest_g, @leave_fest_r,
  @leave_ferie_ap_s, @leave_ferie_ap_g, @leave_ferie_ap_r,
  @leave_ferie_ac_s, @leave_ferie_ac_g, @leave_ferie_ac_r,
  @leave_ferie_s, @leave_ferie_g, @leave_ferie_r,
  @leave_perm_ap_s, @leave_perm_ap_g, @leave_perm_ap_r,
  @leave_perm_ac_s, @leave_perm_ac_g, @leave_perm_ac_r,
  @leave_perm_s, @leave_perm_g, @leave_perm_r,
  @source_file, @imported_at, @parser_version
)
ON CONFLICT(user_id, id) DO UPDATE SET
  pay_date = excluded.pay_date,
  gross_total = excluded.gross_total,
  taxable_income = excluded.taxable_income,
  tax_withheld = excluded.tax_withheld,
  tax_withheld_net = excluded.tax_withheld_net,
  social_withheld = excluded.social_withheld,
  net_to_account = excluded.net_to_account,
  total_competenze = excluded.total_competenze,
  payslip_net = excluded.payslip_net,
  net_pay = excluded.net_pay,
  bank_credit = excluded.bank_credit,
  bank_match_status = excluded.bank_match_status,
  acc_anomalous = excluded.acc_anomalous,
  leave_fest_ap_s = excluded.leave_fest_ap_s,
  leave_fest_ap_g = excluded.leave_fest_ap_g,
  leave_fest_ap_r = excluded.leave_fest_ap_r,
  leave_fest_ac_s = excluded.leave_fest_ac_s,
  leave_fest_ac_g = excluded.leave_fest_ac_g,
  leave_fest_ac_r = excluded.leave_fest_ac_r,
  leave_fest_s = excluded.leave_fest_s,
  leave_fest_g = excluded.leave_fest_g,
  leave_fest_r = excluded.leave_fest_r,
  leave_ferie_ap_s = excluded.leave_ferie_ap_s,
  leave_ferie_ap_g = excluded.leave_ferie_ap_g,
  leave_ferie_ap_r = excluded.leave_ferie_ap_r,
  leave_ferie_ac_s = excluded.leave_ferie_ac_s,
  leave_ferie_ac_g = excluded.leave_ferie_ac_g,
  leave_ferie_ac_r = excluded.leave_ferie_ac_r,
  leave_ferie_s = excluded.leave_ferie_s,
  leave_ferie_g = excluded.leave_ferie_g,
  leave_ferie_r = excluded.leave_ferie_r,
  leave_perm_ap_s = excluded.leave_perm_ap_s,
  leave_perm_ap_g = excluded.leave_perm_ap_g,
  leave_perm_ap_r = excluded.leave_perm_ap_r,
  leave_perm_ac_s = excluded.leave_perm_ac_s,
  leave_perm_ac_g = excluded.leave_perm_ac_g,
  leave_perm_ac_r = excluded.leave_perm_ac_r,
  leave_perm_s = excluded.leave_perm_s,
  leave_perm_g = excluded.leave_perm_g,
  leave_perm_r = excluded.leave_perm_r,
  source_file = excluded.source_file,
  imported_at = excluded.imported_at,
  parser_version = excluded.parser_version
`;

function toParams(userId: number, p: PayslipRecord) {
  return {
    user_id: userId,
    id: p.id,
    period_year: p.periodYear,
    period_month: p.periodMonth,
    period_label: p.periodLabel,
    pay_date: p.payDate,
    gross_total: p.grossTotal,
    taxable_income: p.taxableIncome,
    tax_withheld: p.taxWithheld,
    tax_withheld_net: p.taxWithheldNet,
    social_withheld: p.socialWithheld,
    net_to_account: p.netToAccount,
    total_competenze: p.totalCompetenze,
    payslip_net: p.payslipNet,
    net_pay: p.netPay,
    bank_credit: p.bankCredit,
    bank_match_status: p.bankMatchStatus,
    acc_anomalous: p.accAnomalous ? 1 : 0,
    ...leaveParams("leave_fest", p.leaveFest),
    ...leaveParams("leave_ferie", p.leaveFerie),
    ...leaveParams("leave_perm", p.leavePerm),
    source_file: p.sourceFile,
    imported_at: p.importedAt,
    parser_version: p.parserVersion,
  };
}

/** Elenco cedolini ordinati per periodo. */
export function listPayslips(db: Database.Database, userId: number): PayslipRecord[] {
  const rows = db
    .prepare(`SELECT * FROM payslips WHERE user_id = ? ORDER BY period_year, period_month, period_label`)
    .all(userId) as Row[];
  return rows.map(rowToRecord);
}

/** Inserisce o aggiorna cedolino per (user_id, id). */
export function upsertPayslip(db: Database.Database, userId: number, payslip: PayslipRecord): void {
  db.prepare(UPSERT).run(toParams(userId, payslip));
}

/** Elimina cedolino; restituisce true se esisteva. */
export function deletePayslip(db: Database.Database, userId: number, id: string): boolean {
  const r = db.prepare(`DELETE FROM payslips WHERE user_id = ? AND id = ?`).run(userId, id);
  return r.changes > 0;
}
