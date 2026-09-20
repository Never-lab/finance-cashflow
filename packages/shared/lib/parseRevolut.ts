/**
 * Parser CSV estratto conto Revolut (IT/EN, stati COMPLETED).
 *
 * Ignora movimenti non completati; concatena prodotto pocket in descrizione per categorize/internal.
 */
import type { Transaction } from "../types";
import { categorize } from "./categorize";
import { headerIndex, parseAmount, parseCsvTable, parseDate, transactionId } from "./csv";
import { detectInternal } from "./internal";

const DONE = new Set(["COMPLETED", "COMPLETATO"]);

/**
 * @param text - CSV Revolut con colonne data completamento, descrizione, importo
 * @throws Se intestazioni minime assenti
 */
export function parseRevolut(text: string): Transaction[] {
  const { headers, rows } = parseCsvTable(text);
  const iDate = headerIndex(headers, [
    "Completed Date",
    "Date completed",
    "Data di completamento",
    "Date",
  ]);
  const iDesc = headerIndex(headers, ["Description", "Descrizione", "Reference"]);
  const iAmount = headerIndex(headers, ["Amount", "Importo"]);
  const iState = headerIndex(headers, ["State", "Status", "Stato"]);
  const iCurrency = headerIndex(headers, ["Currency", "Valuta"]);
  const iType = headerIndex(headers, ["Type", "Tipo"]);
  const iProduct = headerIndex(headers, ["Product", "Prodotto"]);

  if (iDate < 0 || iDesc < 0 || iAmount < 0) {
    throw new Error(
      "CSV Revolut non riconosciuto: servono Data di completamento / Completed Date, Descrizione, Importo.",
    );
  }

  const out: Transaction[] = [];
  for (const row of rows) {
    if (iState >= 0) {
      const state = (row[iState] || "").trim().toUpperCase();
      if (state && !DONE.has(state)) continue;
    }

    const date = parseDate(row[iDate] || "");
    const amount = parseAmount(row[iAmount] || "");
    const rawDesc =
      (row[iDesc] || "").trim() ||
      (iType >= 0 ? (row[iType] || "").trim() : "") ||
      "Revolut";
    if (!date || amount === null || amount === 0) continue;

    const product = iProduct >= 0 ? (row[iProduct] || "").trim() : "";
    const tipo = iType >= 0 ? (row[iType] || "").trim() : "";
    const description =
      product && product !== "Attuale" ? `${rawDesc} · ${product}` : rawDesc;

    const currency = (iCurrency >= 0 ? row[iCurrency] : "EUR") || "EUR";
    const id = transactionId("revolut", date, amount, `${product}|${rawDesc}`);
    out.push({
      id,
      date,
      description,
      amount,
      currency,
      source: "revolut",
      category: categorize(description, tipo || product, rawDesc),
      internal: detectInternal({
        source: "revolut",
        description,
        rawDescription: rawDesc,
        tipologia: tipo,
        product,
      }),
    });
  }
  return out;
}
