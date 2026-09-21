/**
 * Estrazione contenuto cedolini PDF: pdf-parse plain (primario), anydoc Markdown (fallback).
 * Privacy: conversione solo locale; mai OCR hosted Firecrawl (cedolini non escono dalla macchina).
 */
import { PDFParse } from "pdf-parse";

export type PayslipExtractKind = "md" | "plain";

export type PayslipExtract = {
  content: string;
  kind: PayslipExtractKind;
};

async function extractPlainText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

/** anydoc locale; null se modulo assente, NeedsOcr, o conversione vuota. */
async function extractMarkdown(buffer: Buffer): Promise<string | null> {
  try {
    const { toMarkdownBytes } = await import("@firecrawl/anydoc");
    const md = await toMarkdownBytes(new Uint8Array(buffer));
    if (typeof md === "string" && md.trim().length > 0) return md;
  } catch {
    return null;
  }
  return null;
}

/**
 * Preferisce plain pdf-parse. Anydoc MD spesso fonde `999 TOT.LORDO` con il codice
 * della riga successiva (`34 CONTRIB.FAP`) → lordo/netto/leave sbagliati o vuoti.
 * Markdown solo se plain vuoto.
 * @param buffer — PDF binario
 */
export async function extractPayslipContent(buffer: Buffer): Promise<PayslipExtract> {
  const plain = await extractPlainText(buffer);
  if (plain.trim().length > 0) return { content: plain, kind: "plain" };
  const md = await extractMarkdown(buffer);
  if (md) return { content: md, kind: "md" };
  return { content: "", kind: "plain" };
}

/**
 * Compat: restituisce solo la stringa estratta (MD o plain).
 * Preferire {@link extractPayslipContent} + {@link parsePayslipContent}.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  return (await extractPayslipContent(buffer)).content;
}
