/**
 * Persistenza PDF cedolini sul volume accanto al DB (Railway `/data/payslips`, locale `data/payslips`).
 * Ruolo: I/O filesystem — path derivato da DATABASE_PATH / PAYSLIPS_DIR.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveDbPath } from "../db";

/** Root cartella PDF: PAYSLIPS_DIR, oppure sibling di finance.db, oppure tmp se DB in-memory. */
export function resolvePayslipsRoot(): string {
  const override = process.env.PAYSLIPS_DIR?.trim();
  if (override) return override;
  const dbPath = resolveDbPath();
  if (dbPath === ":memory:") {
    return path.join(os.tmpdir(), "finance-payslips");
  }
  return path.join(path.dirname(dbPath), "payslips");
}

function safeSegment(id: string): string {
  const s = id.replace(/[^a-zA-Z0-9._-]/g, "_");
  return s || "payslip";
}

/** Path assoluto PDF per user + id cedolino. */
export function payslipPdfPath(userId: number, payslipId: string): string {
  return path.join(resolvePayslipsRoot(), String(userId), `${safeSegment(payslipId)}.pdf`);
}

/** Scrive (o sovrascrive) il PDF sul volume. */
export function savePayslipPdf(userId: number, payslipId: string, buffer: Buffer): string {
  const dest = payslipPdfPath(userId, payslipId);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer);
  return dest;
}

/** Legge PDF se presente. */
export function readPayslipPdf(userId: number, payslipId: string): Buffer | null {
  const dest = payslipPdfPath(userId, payslipId);
  if (!fs.existsSync(dest)) return null;
  return fs.readFileSync(dest);
}

/** Rimuove PDF se esiste (no-op se assente). */
export function deletePayslipPdf(userId: number, payslipId: string): void {
  const dest = payslipPdfPath(userId, payslipId);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
}
