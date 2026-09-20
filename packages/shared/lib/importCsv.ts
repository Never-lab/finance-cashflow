/**
 * Punto di ingresso unificato per import movimenti da testo CSV bancario.
 *
 * Collega rilevamento banca (`detectBank`), parser specifici Mediolanum/Revolut e tipo `Transaction`
 * consumato da `appState.mergeImport` e dalla UI import.
 */
import type { BankSource, Transaction } from "../types";
import { detectBank } from "./detectBank";
import { parseMediolanum } from "./parseMediolanum";
import { parseRevolut } from "./parseRevolut";

/**
 * Importa movimenti da CSV testuale.
 * @param text - Contenuto completo del file CSV
 * @param opts.filename - Nome file (aiuta `detectBank`)
 * @param opts.source - Forza banca se già nota (salta auto-detect)
 * @returns Lista `Transaction` pronta per merge nello stato
 * @throws Se banca non riconosciuta o nessuna riga valida
 */
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
