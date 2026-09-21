/**
 * Estrazione contenuto cedolini PDF: anydoc → Markdown (primario), pdf-parse → plain (fallback).
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
 * Preferisce Markdown via anydoc; fallback testo via pdf-parse.
 * @param buffer — PDF binario
 */
export async function extractPayslipContent(buffer: Buffer): Promise<PayslipExtract> {
  const md = await extractMarkdown(buffer);
  if (md) return { content: md, kind: "md" };
  return { content: await extractPlainText(buffer), kind: "plain" };
}

/**
 * Compat: restituisce solo la stringa estratta (MD o plain).
 * Preferire {@link extractPayslipContent} + {@link parsePayslipContent}.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  return (await extractPayslipContent(buffer)).content;
}
