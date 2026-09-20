/**
 * Parser CSV Banca Mediolanum (export “Elenco movimenti” con preamble).
 *
 * Produce `Transaction` con descrizione ripulita, categoria e flag internal;
 * accoppiato a `liquidity.parseMediolanumBalances` sulla stessa riga saldi.
 */
import type { Transaction } from "../types";
import { categorize } from "./categorize";
import { headerIndex, parseAmount, parseCsvTable, parseDate, transactionId } from "./csv";
import { detectInternal } from "./internal";
import { matchKnownAccount } from "./knownAccounts";

/** Riconosce riga intestazione export ufficiale (Operazione, Descrizione, Uscite/Entrate). */
function isMediolanumHeader(headers: string[]): boolean {
  const hasDesc = headerIndex(headers, ["Descrizione", "Description"]) >= 0;
  const hasDate =
    headerIndex(headers, ["Operazione", "Data", "Data contabile", "Data valuta", "Date"]) >= 0;
  const hasMoney =
    headerIndex(headers, ["Importo", "Amount", "Uscite", "Entrate"]) >= 0;
  return hasDesc && hasDate && hasMoney;
}

/**
 * Accorcia causale Mediolanum per UI: merchant dopo C/O, alias noti (SKY, Satispay), max ~100 caratteri.
 * @param raw - Descrizione grezza CSV
 */
export function cleanMediolanumDescription(raw: string): string {
  const co = raw.match(/C\/O\s+(.+?)\s+CARTA N\./i);
  if (co) return co[1].replace(/\s+/g, " ").trim();

  const sky = raw.match(/\bSKY\b[^]*?ABBONATO\s+\d+/i);
  if (sky) return "SKY";

  const satispay = raw.match(/SATISPAY[^;]*/i);
  if (satispay && /ADDEBITO DIRETTO/i.test(raw)) return "Satispay";

  const fastweb = raw.match(/FASTWEB[^;]*/i);
  if (fastweb) return "Fastweb";

  if (/POCKET REVOLUT|REVOITM/i.test(raw)) return "Bonifico Pocket Revolut";
  if (/RICARICA\/RIMBORSO CARTA.*PREPAGAT/i.test(raw)) return "Ricarica carta prepagata";

  const known = matchKnownAccount(raw);
  if (known) return known.label;

  if (/COMMISSIONE EMISSIONE\/RICARICA CARTA.*PREPAGAT/i.test(raw)) {
    return "Commissione ricarica prepagata";
  }

  const compact = raw.replace(/\s+/g, " ").trim();
  return compact.length > 100 ? `${compact.slice(0, 100)}…` : compact;
}

/**
 * Parsa export Mediolanum completo o fallback Data/Descrizione/Importo.
 * @param text - Contenuto file CSV
 * @throws Se mancano colonne obbligatorie
 */
export function parseMediolanum(text: string): Transaction[] {
  const { headers, rows } = parseCsvTable(text, { isHeader: isMediolanumHeader });
  const iDate = headerIndex(headers, [
    "Operazione",
    "Data",
    "Data contabile",
    "Data valuta",
    "Date",
    "Booking Date",
  ]);
  const iDesc = headerIndex(headers, [
    "Descrizione",
    "Descrizione movimento",
    "Causale",
    "Description",
    "Notes",
  ]);
  const iTipo = headerIndex(headers, ["Tipologia Operazione", "Tipologia", "Type"]);
  const iAmount = headerIndex(headers, ["Importo", "Amount", "Importo (€)", "Importo EUR"]);
  const iEntrate = headerIndex(headers, ["Entrate", "Avere", "Credit"]);
  const iUscite = headerIndex(headers, ["Uscite", "Dare", "Debit"]);

  if (iDate < 0 || iDesc < 0 || (iAmount < 0 && iEntrate < 0 && iUscite < 0)) {
    throw new Error(
      "CSV Mediolanum non riconosciuto: cerco la riga Operazione / Descrizione / Uscite / Entrate.",
    );
  }

  const out: Transaction[] = [];
  for (const row of rows) {
    const date = parseDate(row[iDate] || "");
    const rawDesc = (row[iDesc] || "").trim();
    if (!date || !rawDesc) continue;

    let amount: number | null = null;
    if (iAmount >= 0) {
      amount = parseAmount(row[iAmount] || "");
    } else {
      const credit = iEntrate >= 0 ? parseAmount(row[iEntrate] || "") : null;
      const debit = iUscite >= 0 ? parseAmount(row[iUscite] || "") : null;
      if (credit !== null && credit !== 0) amount = Math.abs(credit);
      else if (debit !== null && debit !== 0) amount = -Math.abs(debit);
    }

    if (amount === null || amount === 0) continue;

    const tipologia = iTipo >= 0 ? (row[iTipo] || "").trim() : "";
    const description = cleanMediolanumDescription(rawDesc);
    const id = transactionId("mediolanum", date, amount, rawDesc);
    out.push({
      id,
      date,
      description,
      amount,
      currency: "EUR",
      source: "mediolanum",
      category: categorize(description, tipologia, rawDesc),
      internal: detectInternal({
        source: "mediolanum",
        description,
        rawDescription: rawDesc,
        tipologia,
      }),
    });
  }
  return out;
}
