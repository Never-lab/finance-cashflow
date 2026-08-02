import type { BankSource, Transaction } from "../types";
import { detectBank } from "./detectBank";
import { parseMediolanum } from "./parseMediolanum";
import { parseRevolut } from "./parseRevolut";

export function importCsv(
  text: string,
  opts: { filename?: string; source?: BankSource } = {},
): Transaction[] {
  const source = opts.source ?? detectBank(text, opts.filename ?? "") ?? undefined;
  if (!source) {
    throw new Error(
      "Banca non riconosciuta. Scegli Mediolanum o Revolut manualmente.",
    );
  }
  const rows = source === "revolut" ? parseRevolut(text) : parseMediolanum(text);
  if (rows.length === 0) {
    throw new Error("Nessun movimento importato dal file.");
  }
  return rows;
}
