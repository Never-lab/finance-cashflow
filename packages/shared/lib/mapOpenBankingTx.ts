/**
 * Map Berlin Group / GoCardless AIS booked transactions → Cash Flow Transaction.
 * Used by server bank-sync; pure so unit-tested without HTTP.
 */
import type { BankSource, Transaction } from "../types";
import { categorize } from "./categorize";
import { detectInternal } from "./internal";
import { transactionId } from "./csv";

/** Minimal Berlin Group booked transaction fields we read. */
export type OpenBankingBookedTx = {
  transactionId?: string;
  entryReference?: string;
  bookingDate?: string;
  valueDate?: string;
  transactionAmount?: { amount?: string; currency?: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  creditorName?: string;
  debtorName?: string;
  additionalInformation?: string;
};

function pickDescription(raw: OpenBankingBookedTx): string {
  const parts: string[] = [];
  if (raw.remittanceInformationUnstructured?.trim()) {
    parts.push(raw.remittanceInformationUnstructured.trim());
  }
  if (raw.remittanceInformationUnstructuredArray?.length) {
    parts.push(...raw.remittanceInformationUnstructuredArray.map((s) => s.trim()).filter(Boolean));
  }
  if (raw.creditorName?.trim()) parts.push(raw.creditorName.trim());
  if (raw.debtorName?.trim()) parts.push(raw.debtorName.trim());
  if (raw.additionalInformation?.trim()) parts.push(raw.additionalInformation.trim());
  const joined = parts.join(" · ").replace(/\s+/g, " ").trim();
  return joined || "Movimento Open Banking";
}

function pickDate(raw: OpenBankingBookedTx): string | null {
  const d = (raw.bookingDate || raw.valueDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return null;
  return d.slice(0, 10);
}

function pickAmount(raw: OpenBankingBookedTx): number | null {
  const s = raw.transactionAmount?.amount?.trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

function pickId(source: BankSource, raw: OpenBankingBookedTx, date: string, amount: number, desc: string): string {
  const ref = (raw.transactionId || raw.entryReference || "").trim();
  if (ref) return `ob|${source}|${ref}`;
  return transactionId(source, date, amount, desc);
}

/**
 * Map one booked AIS transaction. Returns null if amount or date unusable.
 */
export function mapBookedTransaction(raw: OpenBankingBookedTx, source: BankSource): Transaction | null {
  const date = pickDate(raw);
  const amount = pickAmount(raw);
  if (!date || amount === null) return null;

  const description = pickDescription(raw);
  const currency = (raw.transactionAmount?.currency || "EUR").trim() || "EUR";
  const id = pickId(source, raw, date, amount, description);

  return {
    id,
    date,
    description,
    amount,
    currency,
    source,
    category: categorize(description, "", description),
    internal: detectInternal({
      source,
      description,
      rawDescription: description,
    }),
  };
}

/** Map many booked rows; drops unmappable. */
export function mapBookedTransactions(raws: OpenBankingBookedTx[], source: BankSource): Transaction[] {
  const out: Transaction[] = [];
  for (const raw of raws) {
    const t = mapBookedTransaction(raw, source);
    if (t) out.push(t);
  }
  return out;
}
