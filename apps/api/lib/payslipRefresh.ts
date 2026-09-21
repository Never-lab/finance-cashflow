/**
 * Riparse cedolini stale (parser vecchio / leave+netto vuoti) se il PDF è sul volume.
 */
import type Database from "better-sqlite3";
import type { Transaction } from "@shared/types";
import {
  enrichPayslipWithBank,
  parsePayslipContent,
  payslipNeedsReparse,
  type PayslipRecord,
} from "@shared/lib/payslip";
import { extractPayslipContent } from "./pdfExtract";
import { listPayslips, upsertPayslip, deletePayslip } from "./payslipsRepo";
import { readPayslipPdf, savePayslipPdf, deletePayslipPdf } from "./payslipStorage";

export type PayslipRefreshResult = {
  reparsed: number;
  needsReimport: number;
};

/** Riparse e upsert cedolini che falliscono {@link payslipNeedsReparse}. */
export async function refreshStalePayslips(
  db: Database.Database,
  userId: number,
  transactions: Transaction[],
): Promise<PayslipRefreshResult> {
  const existing = listPayslips(db, userId);
  let reparsed = 0;
  let needsReimport = 0;

  for (const old of existing) {
    if (!payslipNeedsReparse(old)) continue;
    const buffer = readPayslipPdf(userId, old.id);
    if (!buffer) {
      needsReimport++;
      continue;
    }
    try {
      const extracted = await extractPayslipContent(buffer);
      const parsed = parsePayslipContent(
        extracted.content,
        extracted.kind,
        old.sourceFile ?? undefined,
      );
      if (!parsed) {
        needsReimport++;
        continue;
      }
      const record: PayslipRecord = enrichPayslipWithBank(
        { ...parsed, importedAt: old.importedAt },
        transactions,
      );
      if (record.id !== old.id) {
        savePayslipPdf(userId, record.id, buffer);
        deletePayslipPdf(userId, old.id);
        deletePayslip(db, userId, old.id);
      }
      upsertPayslip(db, userId, record);
      reparsed++;
    } catch {
      needsReimport++;
    }
  }

  return { reparsed, needsReimport };
}
