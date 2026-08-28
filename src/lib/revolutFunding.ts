import type { Transaction } from "../types";

/** Mediolanum → Revolut pocket top-up (operational edge wallet, not savings). */
export function isMediolanumRevolutFunding(input: {
  source: Transaction["source"];
  description: string;
  rawDescription?: string;
}): boolean {
  if (input.source !== "mediolanum") return false;
  const hay = `${input.description} ${input.rawDescription ?? ""}`;
  return (
    /revoitm|pocket revolut|banca destinataria:.*revolut/i.test(hay) ||
    (/bonifico/i.test(hay) && /revolut/i.test(hay) && !/koti revolution/i.test(hay))
  );
}

/** Revolut incoming bank transfer (mirror leg — exclude from income KPI). */
export function isRevolutBankTopUp(input: {
  source: Transaction["source"];
  description: string;
  rawDescription?: string;
  tipologia?: string;
}): boolean {
  if (input.source !== "revolut") return false;
  const desc = `${input.description} ${input.rawDescription ?? ""}`;
  const tipo = (input.tipologia ?? "").toLowerCase();
  return /^pagamento da\b/i.test(input.description.trim()) || /^pagamento da\b/i.test(desc) || tipo === "ricarica";
}
