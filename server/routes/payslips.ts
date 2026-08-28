import { Hono } from "hono";
import { getDb } from "../db";
import { extractPdfText } from "../lib/pdfExtract";
import { deletePayslip, listPayslips, upsertPayslip } from "../lib/payslipsRepo";
import { loadAppState } from "../lib/stateRepo";
import {
  buildPayslipSummary,
  enrichPayslipWithBank,
  parseOsraPayslipText,
  type PayslipRecord,
} from "../../src/lib/payslip";

export const payslipsRoutes = new Hono();

function filesFromBody(body: Record<string, unknown>): File[] {
  const files: File[] = [];
  for (const value of Object.values(body)) {
    if (value instanceof File) files.push(value);
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (item instanceof File) files.push(item);
      }
    }
  }
  return files;
}

payslipsRoutes.get("/payslips", (c) => {
  const db = getDb();
  const payslips = listPayslips(db);
  const transactions = loadAppState(db).transactions;
  return c.json(buildPayslipSummary(payslips, transactions));
});

payslipsRoutes.post("/payslips/preview", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: "file required" }, 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractPdfText(buffer);
  const parsed = parseOsraPayslipText(text, file.name);
  if (!parsed) return c.json({ error: "Formato cedolino non riconosciuto (atteso OSRA/OLUIT)" }, 422);

  const transactions = loadAppState(getDb()).transactions;
  return c.json({ payslip: enrichPayslipWithBank(parsed, transactions) });
});

payslipsRoutes.post("/payslips/import", async (c) => {
  const body = await c.req.parseBody({ all: true });
  const db = getDb();
  const transactions = loadAppState(db).transactions;

  const files = filesFromBody(body);
  if (files.length === 0) return c.json({ error: "Nessun file PDF" }, 400);

  const imported: PayslipRecord[] = [];
  const errors: { file: string; error: string }[] = [];

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = await extractPdfText(buffer);
      const parsed = parseOsraPayslipText(text, file.name);
      if (!parsed) {
        errors.push({ file: file.name, error: "Formato non riconosciuto" });
        continue;
      }
      const enriched = enrichPayslipWithBank(
        { ...parsed, importedAt: new Date().toISOString() },
        transactions,
      );
      upsertPayslip(db, enriched);
      imported.push(enriched);
    } catch (e) {
      errors.push({
        file: file.name,
        error: e instanceof Error ? e.message : "Errore lettura PDF",
      });
    }
  }

  const payslips = listPayslips(db);
  return c.json({
    imported: imported.length,
    errors,
    summary: buildPayslipSummary(payslips, transactions),
  });
});

payslipsRoutes.delete("/payslips/:id", (c) => {
  const id = c.req.param("id");
  const ok = deletePayslip(getDb(), id);
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});
