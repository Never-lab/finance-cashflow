/**
 * Rilevamento automatico banca (Mediolanum vs Revolut) da nome file, snippet testo e intestazioni CSV.
 *
 * Usato da `importCsv` quando l’utente non seleziona la banca; evita parser sbagliati su colonne incompatibili.
 */
import type { BankSource } from "../types";
import { headerIndex, parseCsvTable } from "./csv";

/**
 * @param text - Contenuto CSV
 * @param filename - Nome file originale (euristiche Revolut `account-statement`, Mediolanum `elenco movimenti`)
 * @returns `"mediolanum"`, `"revolut"` o null se ambiguo
 */
export function detectBank(text: string, filename = ""): BankSource | null {
  const name = filename.toLowerCase();
  if (name.includes("revolut") || name.includes("account-statement")) {
    return "revolut";
  }
  if (
    name.includes("mediolanum") ||
    name.includes("bmed") ||
    name.includes("elenco movimenti")
  ) {
    return "mediolanum";
  }

  const lower = text.toLowerCase();
  if (
    lower.includes("tipologia operazione") &&
    lower.includes("uscite") &&
    lower.includes("entrate")
  ) {
    return "mediolanum";
  }
  if (
    lower.includes("data di completamento") ||
    (lower.includes("prodotto") && lower.includes("importo") && lower.includes("state"))
  ) {
    return "revolut";
  }

  const { headers } = parseCsvTable(text);
  const joined = headers.join(" ").toLowerCase();

  if (
    headerIndex(headers, [
      "Completed Date",
      "Started Date",
      "Data di completamento",
      "Data di inizio",
    ]) >= 0 &&
    headerIndex(headers, ["Product", "Prodotto", "Type", "Tipo", "State"]) >= 0
  ) {
    return "revolut";
  }
  if (joined.includes("revolut") || headerIndex(headers, ["Product", "Prodotto"]) >= 0) {
    return "revolut";
  }
  if (
    headerIndex(headers, ["Operazione", "Data", "Data contabile", "Data valuta"]) >= 0 &&
    headerIndex(headers, ["Descrizione", "Causale", "Descrizione movimento"]) >= 0
  ) {
    return "mediolanum";
  }
  return null;
}
