/**
 * Snapshot saldi da righe CSV e vista liquidità totale (Mediolanum + Revolut pocket).
 *
 * Complementa i movimenti: saldi non derivano dalla somma transazioni ma da export banca;
 * `buildLiquidityView` alimenta widget dashboard e import freshness.
 */
import type { BankSource, Transaction } from "../types";
import { parseAmount } from "./csv";

/** Saldo contabile/disponibile da riga 2 export Mediolanum. */
export type MediolanumBalanceSnapshot = {
  ledger: number;
  available: number;
  asOf: string;
  importedAt: string;
};

/** Saldi per prodotto Revolut (Attuale, Risparmi, Deposito) + pending. */
export type RevolutBalanceSnapshot = {
  attuale: number;
  risparmi: number;
  deposito: number;
  pendingAttuale: number;
  asOf: string;
  importedAt: string;
};

/** Ultimi snapshot per banca persistiti post-import. */
export type LiquiditySnapshots = {
  mediolanum?: MediolanumBalanceSnapshot;
  revolut?: RevolutBalanceSnapshot;
};

/** Stima sotto-pocket Viaggio / Manutenzione da movimenti · Risparmi. */
export type RevolutPocketEstimate = {
  viaggio: number;
  manutenzioneAuto: number;
};

/** DTO liquidità per API/UI dashboard. */
export type LiquidityView = {
  mediolanum: MediolanumBalanceSnapshot | null;
  revolut: RevolutBalanceSnapshot | null;
  /** Attuale al netto autorizzazioni carta in sospeso (ultimo export) */
  revolutAttualeEffective: number | null;
  pockets: RevolutPocketEstimate | null;
  totalEur: number | null;
  note: string | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Riga 2 CSV Mediolanum: Nickname;IBAN;Saldo contabile;Saldo disponibile.
 * @param importedAt - Timestamp import per freshness
 */
export function parseMediolanumBalances(text: string, importedAt = new Date().toISOString()): MediolanumBalanceSnapshot | null {
  const line = text.replace(/^\uFEFF/, "").split(/\r?\n/)[1];
  if (!line) return null;
  const parts = line.split(";");
  const amounts = parts.slice(2).map((p) => parseAmount(p.replace(/\s*€\s*/g, ""))).filter((n): n is number => n !== null);
  if (amounts.length < 2) return null;
  return {
    ledger: round2(amounts[0]!),
    available: round2(amounts[1]!),
    asOf: new Date().toISOString().slice(0, 10),
    importedAt,
  };
}

type RevolutRawRow = {
  dt: string;
  product: string;
  amount: number;
  balance: number;
  state: string;
};

function parseRevolutRawRows(text: string): RevolutRawRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).slice(1).filter(Boolean);
  const out: RevolutRawRow[] = [];
  for (const line of lines) {
    const cols = line.split(",");
    const product = cols[1]?.trim() ?? "";
    const state = cols[8]?.trim() ?? "";
    const amount = Number(cols[5]);
    const balance = Number(cols[9]);
    const dt = cols[3]?.trim() || cols[2]?.trim() || "";
    if (!product || Number.isNaN(amount)) continue;
    out.push({ dt, product, amount, balance, state });
  }
  return out;
}

/** Ultimo saldo per prodotto Revolut (stato COMPLETATO) + somma pending Attuale. */
export function parseRevolutBalances(text: string, importedAt = new Date().toISOString()): RevolutBalanceSnapshot | null {
  const rows = parseRevolutRawRows(text);
  if (rows.length === 0) return null;

  const latest: Partial<Record<string, RevolutRawRow>> = {};
  let pendingAttuale = 0;
  let lastCompletedDt = "";

  for (const r of rows) {
    if (r.state === "COMPLETATO" && !Number.isNaN(r.balance)) {
      const prev = latest[r.product];
      if (!prev || r.dt.localeCompare(prev.dt) >= 0) latest[r.product] = r;
      if (r.dt > lastCompletedDt) lastCompletedDt = r.dt;
    }
    if (r.state === "In sospeso" && r.product === "Attuale" && r.amount < 0) {
      pendingAttuale += -r.amount;
    }
  }

  const attuale = latest.Attuale?.balance;
  const risparmi = latest.Risparmi?.balance;
  const deposito = latest.Deposito?.balance;
  if (attuale === undefined && risparmi === undefined && deposito === undefined) return null;

  return {
    attuale: round2(attuale ?? 0),
    risparmi: round2(risparmi ?? 0),
    deposito: round2(deposito ?? 0),
    pendingAttuale: round2(pendingAttuale),
    asOf: (lastCompletedDt || importedAt).slice(0, 10),
    importedAt,
  };
}

/** Estrae snapshot parziale in base a source rilevata. */
export function extractLiquidityFromCsv(
  text: string,
  source: BankSource,
  importedAt = new Date().toISOString(),
): Partial<LiquiditySnapshots> {
  if (source === "mediolanum") {
    const med = parseMediolanumBalances(text, importedAt);
    return med ? { mediolanum: med } : {};
  }
  const rev = parseRevolutBalances(text, importedAt);
  return rev ? { revolut: rev } : {};
}

/** Merge non distruttivo: patch sovrascrive solo banche presenti. */
export function mergeLiquiditySnapshots(
  base: LiquiditySnapshots,
  patch: Partial<LiquiditySnapshots>,
): LiquiditySnapshots {
  return {
    mediolanum: patch.mediolanum ?? base.mediolanum,
    revolut: patch.revolut ?? base.revolut,
  };
}

function isRisparmiLine(description: string): boolean {
  return /·\s*risparmi/i.test(description);
}

type PocketMove = "viaggio_in" | "manutenzione_in" | "instant_in" | "card" | "prelievo" | "skip";

function classifyRisparmiMove(description: string): PocketMove {
  const d = description.toLowerCase();
  if (/prelievo da pocket/i.test(d)) return "prelievo";
  if (/accredita eur viaggio/i.test(d)) return "viaggio_in";
  if (/accredita eur manutenzione auto/i.test(d)) return "manutenzione_in";
  if (/from instant access/i.test(d)) return "instant_in";
  if (/interessi netti/i.test(d)) return "skip";
  return "card";
}

/** Abbina prelievo pocket a uscita Attuale stesso giorno (es. Angela → Manutenzione). */
function prelievoPocketTarget(t: Transaction, transactions: Transaction[]): "viaggio" | "manutenzione" {
  const out = -t.amount;
  const sameDay = transactions.filter(
    (x) =>
      x.source === "revolut" &&
      !isRisparmiLine(x.description) &&
      x.date === t.date &&
      x.amount < 0 &&
      Math.abs(x.amount - out) < 0.02,
  );
  if (sameDay.some((x) => /angela pasquini/i.test(x.description))) return "manutenzione";
  return "viaggio";
}

function applySpend(viaggio: number, manutenzione: number, spend: number, prefer: "viaggio" | "manutenzione") {
  if (prefer === "manutenzione") {
    const fromMan = Math.min(manutenzione, spend);
    manutenzione -= fromMan;
    viaggio -= spend - fromMan;
  } else {
    const fromVi = Math.min(viaggio, spend);
    viaggio -= fromVi;
    manutenzione -= spend - fromVi;
  }
  return { viaggio, manutenzione };
}

/**
 * Stima saldi Viaggio / Manutenzione da movimenti “· Risparmi”.
 * Prelievi con controparte Angela → Manutenzione; altri prelievi/POS scalano prima Viaggio.
 */
export function estimateRevolutPockets(transactions: Transaction[]): RevolutPocketEstimate {
  let viaggio = 0;
  let manutenzione = 0;

  const risparmi = transactions
    .filter((t) => t.source === "revolut" && isRisparmiLine(t.description))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  for (const t of risparmi) {
    const move = classifyRisparmiMove(t.description);
    if (move === "skip") continue;
    if (move === "viaggio_in" || move === "instant_in") viaggio += t.amount;
    else if (move === "manutenzione_in") manutenzione += t.amount;
    else if (move === "card" && t.amount < 0) {
      const spend = -t.amount;
      ({ viaggio, manutenzione } = applySpend(viaggio, manutenzione, spend, "viaggio"));
    } else if (move === "prelievo" && t.amount < 0) {
      const out = -t.amount;
      const target = prelievoPocketTarget(t, transactions);
      ({ viaggio, manutenzione } = applySpend(viaggio, manutenzione, out, target));
    }
  }

  return {
    viaggio: round2(Math.max(0, viaggio)),
    manutenzioneAuto: round2(Math.max(0, manutenzione)),
  };
}

/**
 * Vista unificata liquidità EUR + note UI se manca un export.
 * @param snapshots - Saldi da DB/ultimo import
 * @param transactions - Per stima pocket Revolut
 */
export function buildLiquidityView(
  snapshots: LiquiditySnapshots,
  transactions: Transaction[],
): LiquidityView {
  const med = snapshots.mediolanum ?? null;
  const rev = snapshots.revolut ?? null;
  const revolutAttualeEffective =
    rev !== null ? round2(rev.attuale - rev.pendingAttuale) : null;

  const pockets =
    transactions.some((t) => t.source === "revolut" && isRisparmiLine(t.description))
      ? estimateRevolutPockets(transactions)
      : null;

  let totalEur: number | null = null;
  if (med || rev) {
    totalEur = round2(
      (med?.available ?? 0) +
        (revolutAttualeEffective ?? rev?.attuale ?? 0) +
        (rev?.risparmi ?? 0) +
        (rev?.deposito ?? 0),
    );
  }

  let note: string | null = null;
  if (!med && !rev) {
    note = "Importa i CSV Mediolanum e Revolut per aggiornare i saldi.";
  } else if (!med || !rev) {
    note = "Importa entrambi i CSV per il totale liquidità completo.";
  } else if (rev.pendingAttuale > 0) {
    note = `Attuale effettivo al netto di ${round2(rev.pendingAttuale)} € in sospeso (ultimo export Revolut).`;
  }

  return {
    mediolanum: med,
    revolut: rev,
    revolutAttualeEffective,
    pockets,
    totalEur,
    note,
  };
}
