/**
 * Estrazione testo da PDF lato server (cedolini).
 * Ruolo: lib I/O — usa pdf-parse; buffer non persistito oltre la richiesta.
 * Privacy: il contenuto del cedolino transita solo in memoria durante parse.
 */
import { PDFParse } from "pdf-parse";

/**
 * Estrae testo plain da un buffer PDF.
 * @param buffer — contenuto binario del file caricato.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}
