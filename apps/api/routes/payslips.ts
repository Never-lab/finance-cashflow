/**
 * Route cedolini/paghe: elenco, anteprima PDF, import batch, cancellazione.
 * Endpoint: GET /payslips, POST /payslips/preview, POST /payslips/import, DELETE /payslips/:id.
 * Tabelle: payslips; legge transactions per abbinamento accredito banca.
 * Privacy: PDF salvati su volume (`data/payslips` / Railway `/data/payslips`); numeri anche in SQLite.
 */
import { Hono } from "hono";
import { getDb } from "../db";
import { extractPayslipContent } from "../lib/pdfExtract";
import { deletePayslip, listPayslips, upsertPayslip } from "../lib/payslipsRepo";
import { refreshStalePayslips } from "../lib/payslipRefresh";
import { deletePayslipPdf, savePayslipPdf } from "../lib/payslipStorage";
import { loadAppState } from "../lib/stateRepo";
import {
  buildPayslipSummary,
  enrichPayslipWithBank,
  parsePayslipContent,
  type PayslipRecord,
} from "@shared/lib/payslip";
import { getUserId } from "../lib/requestContext";
import type { AppEnv } from "../lib/honoTypes";

export const payslipsRoutes = new Hono<AppEnv>();

/** Estrae tutti i File da body multipart (campi singoli o array, qualsiasi nome campo). */
function filesFromBody(body: Record<string, unknown>): File[] {
  const files: File[] = [];
  for (const value of Object.values(body)) {
    if (value instanceof File) {
      if (isPdfFile(value)) files.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item instanceof File && isPdfFile(item)) files.push(item);
      }
    }
  }
  return files;
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/** GET /api/payslips — riepilogo cedolini + confronto con movimenti; riparse stale se PDF presente. */
payslipsRoutes.get("/payslips", async (c) => {
  const userId = getUserId(c);
  const db = getDb();
  const transactions = loadAppState(db, userId).transactions;
  const refresh = await refreshStalePayslips(db, userId, transactions);
  const payslips = listPayslips(db, userId);
  return c.json({
    ...buildPayslipSummary(payslips, transactions),
    refresh,
  });
});

/** POST /api/payslips/preview — parse PDF senza persistenza. */
payslipsRoutes.post("/payslips/preview", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: "file required" }, 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const extracted = await extractPayslipContent(buffer);
  const parsed = parsePayslipContent(extracted.content, extracted.kind, file.name);
  if (!parsed) return c.json({ error: "Formato cedolino non riconosciuto (atteso OSRA/OLUIT)" }, 422);

  const transactions = loadAppState(getDb(), userId).transactions;
  return c.json({ payslip: enrichPayslipWithBank(parsed, transactions) });
});

/** POST /api/payslips/import — importa uno o più PDF OSRA/OLUIT. */
payslipsRoutes.post("/payslips/import", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.parseBody({ all: true });
  const db = getDb();
  const transactions = loadAppState(db, userId).transactions;

  const files = filesFromBody(body);
  if (files.length === 0) return c.json({ error: "Nessun file PDF" }, 400);

  const imported: PayslipRecord[] = [];
  const errors: { file: string; error: string }[] = [];

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractPayslipContent(buffer);
      const parsed = parsePayslipContent(extracted.content, extracted.kind, file.name);
      if (!parsed) {
        errors.push({ file: file.name, error: "Formato non riconosciuto" });
        continue;
      }
      const enriched = enrichPayslipWithBank(
        { ...parsed, importedAt: new Date().toISOString() },
        transactions,
      );
      upsertPayslip(db, userId, enriched);
      savePayslipPdf(userId, enriched.id, buffer);
      imported.push(enriched);
    } catch (e) {
      errors.push({
        file: file.name,
        error: e instanceof Error ? e.message : "Errore lettura PDF",
      });
    }
  }

  const payslips = listPayslips(db, userId);
  return c.json({
    imported: imported.length,
    errors,
    summary: buildPayslipSummary(payslips, transactions),
  });
});

/** DELETE /api/payslips/:id — rimuove cedolino salvato e PDF sul volume. */
payslipsRoutes.delete("/payslips/:id", (c) => {
  const userId = getUserId(c);
  const id = c.req.param("id");
  const ok = deletePayslip(getDb(), userId, id);
  if (!ok) return c.json({ error: "Not found" }, 404);
  deletePayslipPdf(userId, id);
  return c.json({ ok: true });
});
