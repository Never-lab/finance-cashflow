import type { BankSource, Transaction } from "../types";
import { matchKnownAccount } from "./knownAccounts";

/**
 * Own-account moves: exclude from cash-flow KPIs/charts, keep in Movimenti.
 */
export function detectInternal(input: {
  source: BankSource;
  description: string;
  rawDescription?: string;
  tipologia?: string;
  product?: string;
}): boolean {
  const desc = `${input.description} ${input.rawDescription ?? ""}`;
  const tipo = (input.tipologia ?? "").toLowerCase();
  const product = (input.product ?? "").toLowerCase();

  if (input.source === "revolut") {
    if (/interessi/i.test(tipo) || /interessi netti/i.test(desc)) return false;

    if (
      product === "risparmi" ||
      product === "deposito" ||
      /·\s*risparmi\b/i.test(input.description) ||
      /·\s*deposito\b/i.test(input.description)
    ) {
      return true;
    }

    return (
      /accredita eur/i.test(desc) ||
      /deposito senza vincoli/i.test(desc) ||
      /^dal deposito/i.test(input.description) ||
      /^per i depositi/i.test(input.description) ||
      /pagamento da /i.test(desc) ||
      /^to [a-z]/i.test(input.description.trim())
    );
  }

  if (/commissione.*prepagat/i.test(desc)) return false;
  if (/imposta di bollo/i.test(desc)) return false;

  if (matchKnownAccount(desc)) return true;
  if (/fondo emergenza mediolanum/i.test(desc)) return true;

  if (/ricarica\/rimborso carta.*prepagat/i.test(desc)) return true;
  if (/carta\/e prepagata/i.test(desc) && /ricarica/i.test(desc) && !/commissione/i.test(desc)) {
    return true;
  }
  if (/ricarica carta prepagata/i.test(desc)) return true;

  if (/revoitm|pocket revolut|banca destinataria:.*revolut/i.test(desc)) return true;
  if (/bonifico pocket revolut/i.test(desc)) return true;
  if (/bonifico/i.test(desc) && /revolut/i.test(desc) && !/koti revolution/i.test(desc)) {
    return true;
  }

  if (
    /versamento.*invest/i.test(desc) ||
    /sottoscrizione/i.test(desc) ||
    /\bsicav\b/i.test(desc) ||
    /\bpir\b/i.test(desc) ||
    /conto deposito/i.test(desc) ||
    /deposito vincolat/i.test(desc) ||
    /gestione patrimoniale/i.test(desc) ||
    /acquisto fondi/i.test(desc) ||
    /versamento fondi/i.test(desc) ||
    /dossier titoli.*versamento/i.test(desc)
  ) {
    return true;
  }

  if (tipo.includes("ricariche") && /prepagat/i.test(desc) && !/commissione/i.test(desc)) {
    return true;
  }

  return false;
}

/** Resolve internal: manual override wins, else fresh heuristic (ignore stale persisted flag). */
export function resolveInternal(
  t: Transaction,
  overrides: Record<string, boolean> = {},
): boolean {
  if (Object.prototype.hasOwnProperty.call(overrides, t.id)) {
    return overrides[t.id]!;
  }
  return detectInternal({
    source: t.source,
    description: t.description,
    rawDescription: t.description,
  });
}

export function withResolvedInternal(
  t: Transaction,
  overrides: Record<string, boolean> = {},
): Transaction {
  return { ...t, internal: resolveInternal(t, overrides) };
}

export function forCashflow(txns: Transaction[]): Transaction[] {
  return txns.filter((t) => !t.internal);
}
