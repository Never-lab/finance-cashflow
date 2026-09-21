/**
 * Parser buste paga OSRA/Wolters Kluwer (testo estratto PDF) e confronto con accredito Mediolanum.
 *
 * Pipeline: amounts → leave grid → resolvePayslipNet → matchBank → netPay KPI.
 * Dati persistiti separatamente dai movimenti CSV.
 */
import type { Transaction } from "../types";

/** Versione parser per migrazioni e invalidazione cache. */
export const PAYSLIP_PARSER_VERSION = "osra-oluit-8-leave";

/** Kind contenuto estratto (Markdown anydoc vs plain pdf-parse). */
export type PayslipContentKind = "md" | "plain";

/** Esito abbinamento accredito banca vs netto cedolino. */
export type BankMatchStatus = "matched" | "doubt" | "missing";

/** Ferie/permessi/festività: spettanti, godute, residue per sezione. */
export type PayslipLeaveSlice = {
  spettanti: number | null;
  godute: number | null;
  residue: number | null;
};

/** Leave con ripartizione AP/AC e totali sommati. */
export type PayslipLeave = PayslipLeaveSlice & {
  ap: PayslipLeaveSlice;
  ac: PayslipLeaveSlice;
};

/** Busta paga normalizzata per periodo e import. */
export type PayslipRecord = {
  id: string;
  periodYear: number;
  periodMonth: number;
  periodLabel: string;
  payDate: string | null;
  grossTotal: number | null;
  taxableIncome: number | null;
  taxWithheld: number | null;
  taxWithheldNet: number | null;
  socialWithheld: number | null;
  netToAccount: number | null;
  totalCompetenze: number | null;
  /** Netto risolto dal solo cedolino (Acc. c.c. o calcolato). */
  payslipNet: number | null;
  /** Netto KPI: banca se matched, altrimenti payslipNet. */
  netPay: number | null;
  bankCredit: number | null;
  bankMatchStatus: BankMatchStatus;
  accAnomalous: boolean;
  leaveFest: PayslipLeave;
  leaveFerie: PayslipLeave;
  leavePerm: PayslipLeave;
  sourceFile: string | null;
  importedAt: string;
  parserVersion: string;
};

/** Aggregati UI: medie 6 mesi e serie grafici netto/ferie. */
export type PayslipSummary = {
  payslips: PayslipRecord[];
  latest: PayslipRecord | null;
  avgNet6: number | null;
  avgGross6: number | null;
  chartNet: { period: string; netPay: number; grossTotal: number | null; bankCredit: number | null }[];
  chartLeave: {
    period: string;
    ferieResidueAp: number | null;
    ferieResidueAc: number | null;
    permResidueAp: number | null;
    permResidueAc: number | null;
    festResidueAp: number | null;
    festResidueAc: number | null;
  }[];
  /** Cedolini riparsati al volo / da ri-importare (PDF assente sul volume). */
  refresh?: { reparsed: number; needsReimport: number };
};

const AMOUNT_EPS = 1;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Importo busta paga IT: 2.407,43 → 2407.43.
 * @param raw - Stringa con separatori migliaia/decimali italiani
 */
export function parseItalianAmount(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  if (!s || s === "—" || s === "-") return null;
  // OSRA PDF extract often glues a trailing minus: "18,67-" → -18.67
  const neg = s.endsWith("-");
  const core = neg ? s.slice(0, -1) : s;
  if (!core) return null;
  const n = Number(core.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return round2(neg ? -n : n);
}

function slugLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseItDate(raw: string): string | null {
  const m = raw.trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function amt(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern);
  return m?.[1] ? parseItalianAmount(m[1]) : null;
}

const emptySlice = (): PayslipLeaveSlice => ({
  spettanti: null,
  godute: null,
  residue: null,
});

function sumLeave(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return round2((a ?? 0) + (b ?? 0));
}

/** Combina slice AP/AC con totali somma per campo. */
export function buildLeave(ap: PayslipLeaveSlice, ac: PayslipLeaveSlice = emptySlice()): PayslipLeave {
  return {
    ap,
    ac,
    spettanti: sumLeave(ap.spettanti, ac.spettanti),
    godute: sumLeave(ap.godute, ac.godute),
    residue: sumLeave(ap.residue, ac.residue),
  };
}

function near(a: number, b: number, eps = AMOUNT_EPS): boolean {
  return Math.abs(a - b) <= eps;
}

/**
 * Interpreta una tripla colonna OSRA (3 numeri) + residuo/godute riga AP.
 *
 * Casi:
 * - classico spett/god/res (a−b≈c)
 * - AP/AC: a=spett AP, b=spett AC; se c > residuo AP allora c = residuo totale
 * - AP/AC con b=0: a=spett AP, c=spett AC
 * - solo residuo in c
 */
export function splitLeaveTriple(
  triple: number[],
  apResidue: number | null,
  apGodute: number | null,
): PayslipLeave {
  const [a, b, c] = triple;
  if (a === 0 && b === 0 && c === 0) return buildLeave(emptySlice());

  // Classico: spettanti − godute ≈ residue. Fidati della riga "Residuo :" se presente
  // (anche 0): PDF extract a volte mette meno trailing sul terzo valore (−18,67-).
  if (b > 0 && near(a - b, c, 0.02)) {
    const computed = round2(a - b);
    const residue =
      apResidue != null && !(apResidue === 0 && c > 0) ? apResidue : computed;
    return buildLeave({ spettanti: a, godute: b, residue });
  }

  // AP spettanti + AC spettanti; c spesso residuo totale (non residuo AC)
  if (b > 0 && b < a && !near(a - b, c, 0.02)) {
    const acResidue =
      apResidue != null && c > apResidue + 0.02 ? round2(c - apResidue) : c;
    return buildLeave(
      { spettanti: a, godute: apGodute, residue: apResidue },
      { spettanti: b, godute: null, residue: acResidue },
    );
  }

  // AP spettanti + AC spettanti (middle vuoto)
  if (a > 0 && c > 0 && b === 0) {
    return buildLeave(
      { spettanti: a, godute: apGodute, residue: apResidue },
      { spettanti: c, godute: null, residue: null },
    );
  }

  // Solo residuo (o residuo riga AP)
  if (a === 0 && b === 0 && c > 0) {
    return buildLeave({
      spettanti: null,
      godute: apGodute,
      residue: apResidue != null && !(apResidue === 0 && c > 0) ? apResidue : c,
    });
  }

  return buildLeave({
    spettanti: a,
    godute: b !== 0 ? b : apGodute,
    residue: apResidue != null && !(apResidue === 0 && c > 0) ? apResidue : c,
  });
}

function daysBetween(isoA: string, isoB: string): number {
  const a = Date.parse(`${isoA}T00:00:00Z`);
  const b = Date.parse(`${isoB}T00:00:00Z`);
  return Math.abs(Math.round((a - b) / 86_400_000));
}

type LeaveKind = "ferie" | "fest" | "perm";

type LeaveBundle = {
  leaveFerie: PayslipLeave;
  leaveFest: PayslipLeave;
  leavePerm: PayslipLeave;
};

function leaveSliceEmpty(leave: PayslipLeave): boolean {
  return (
    leave.spettanti == null &&
    leave.godute == null &&
    leave.residue == null &&
    leave.ap.spettanti == null &&
    leave.ap.godute == null &&
    leave.ap.residue == null &&
    leave.ac.spettanti == null &&
    leave.ac.godute == null &&
    leave.ac.residue == null
  );
}

/**
 * Template AFEA: header spesso `FEST. FERIE PERM.` con ferie nella prima colonna.
 * Promuove solo se l'ordine colonne inizia con FEST e FERIE è vuota.
 */
function normalizeAfeaLeaveColumns(bundle: LeaveBundle, order: LeaveKind[]): LeaveBundle {
  if (order[0] !== "fest") return bundle;
  if (leaveSliceEmpty(bundle.leaveFerie) && !leaveSliceEmpty(bundle.leaveFest)) {
    return {
      leaveFerie: bundle.leaveFest,
      leaveFest: buildLeave(emptySlice()),
      leavePerm: bundle.leavePerm,
    };
  }
  return bundle;
}

/** Ordine colonne griglia: da header se presente, default FERIE | FEST | PERM. */
function detectLeaveColumnOrder(text: string): LeaveKind[] {
  const header = text.match(/((?:FEST\.?|FERIE|PERM\.?)[\s.]+){2,}(?:FEST\.?|FERIE|PERM\.?)/i);
  if (!header) return ["ferie", "fest", "perm"];

  const kinds: LeaveKind[] = [];
  const re = /FEST\.?|FERIE|PERM\.?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header[0]!)) !== null && kinds.length < 3) {
    const t = m[0].toUpperCase().replace(/\./g, "");
    if (t.startsWith("FEST")) kinds.push("fest");
    else if (t.startsWith("FERIE")) kinds.push("ferie");
    else kinds.push("perm");
  }
  return kinds.length === 3 ? kinds : ["ferie", "fest", "perm"];
}

/** Importo IT in testo PDF, con meno trailing opzionale (`26,66-`). */
const IT_AMOUNT_RE = /\d{1,3}(?:\.\d{3})*,\d{2}-?/g;

/** Griglia footer OSRA: 3 colonne × (AP/AC spett, god, res) in 9 numeri + residuo/godute. */
function parseLeaveGrid(text: string): {
  leaveFerie: PayslipLeave;
  leaveFest: PayslipLeave;
  leavePerm: PayslipLeave;
} {
  const empty = buildLeave(emptySlice());
  const order = detectLeaveColumnOrder(text);

  // Multi-page PDF: form blank on early pages, real Residuo on later ones — take last non-zero.
  const blockRe =
    /Residuo\s*:\s*([\d.,]+)\s+Residuo\s*:\s*([\d.,]+)\s+Residuo\s*:\s*([\d.,]+)\s*\n([^\n]+)/gi;
  type LeaveBlock = { resCols: (number | null)[]; triples: number[][]; allZero: boolean };
  const blocks: LeaveBlock[] = [];
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRe.exec(text)) !== null) {
    const gridNums = blockMatch[4]!.match(IT_AMOUNT_RE);
    if (!gridNums || gridNums.length < 9) continue;
    const n = gridNums.slice(0, 9).map((raw) => parseItalianAmount(raw)!);
    blocks.push({
      resCols: [
        parseItalianAmount(blockMatch[1]!),
        parseItalianAmount(blockMatch[2]!),
        parseItalianAmount(blockMatch[3]!),
      ],
      triples: [n.slice(0, 3), n.slice(3, 6), n.slice(6, 9)],
      allZero: n.every((x) => x === 0),
    });
  }

  const chosen =
    [...blocks].reverse().find((b) => !b.allZero) ?? blocks[blocks.length - 1];
  if (!chosen) {
    return { leaveFerie: empty, leaveFest: empty, leavePerm: empty };
  }

  const godute = text.match(
    /\d{1,2}\/\d{1,2}\/\d{4}\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*\n\s*Ore/i,
  );
  const godCols = godute
    ? [parseItalianAmount(godute[1]!), parseItalianAmount(godute[2]!), parseItalianAmount(godute[3]!)]
    : [null, null, null];

  const byKind: Record<LeaveKind, PayslipLeave> = {
    ferie: empty,
    fest: empty,
    perm: empty,
  };

  for (let i = 0; i < 3; i++) {
    const kind = order[i]!;
    byKind[kind] = splitLeaveTriple(chosen.triples[i]!, chosen.resCols[i] ?? null, godCols[i] ?? null);
  }

  return normalizeAfeaLeaveColumns(
    {
      leaveFerie: byKind.ferie,
      leaveFest: byKind.fest,
      leavePerm: byKind.perm,
    },
    order,
  );
}

/** Rimuove markup GFM lasciando label/importi leggibili dalle regex plain. */
export function stripMarkdownNoise(md: string): string {
  return md
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ {2,}/g, " ");
}

/**
 * Griglia ferie da tabella GFM (header FERIE/FEST/PERM + riga Residuo + 9 numeri).
 * Null se la struttura tabella non è riconoscibile.
 */
function parseLeaveFromMarkdownTables(md: string): LeaveBundle | null {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const headerIdx = lines.findIndex(
    (l) => /FERIE/i.test(l) && /FEST/i.test(l) && /PERM/i.test(l) && l.includes("|"),
  );
  if (headerIdx < 0) return null;

  const order = detectLeaveColumnOrder(lines[headerIdx]!);
  const empty = buildLeave(emptySlice());

  let resCols: (number | null)[] = [null, null, null];
  let gridNums: number[] | null = null;
  let godCols: (number | null)[] = [null, null, null];

  for (let i = headerIdx + 1; i < lines.length && i < headerIdx + 12; i++) {
    const line = lines[i]!;
    if (/residuo/i.test(line)) {
      const nums = line.match(IT_AMOUNT_RE);
      if (nums && nums.length >= 3) {
        resCols = [
          parseItalianAmount(nums[0]!),
          parseItalianAmount(nums[1]!),
          parseItalianAmount(nums[2]!),
        ];
      }
      continue;
    }
    if (!gridNums) {
      const nums = line.match(IT_AMOUNT_RE);
      if (nums && nums.length >= 9) {
        gridNums = nums.slice(0, 9).map((raw) => parseItalianAmount(raw)!);
        continue;
      }
    }
    if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(line) && /ore/i.test(lines[i + 1] ?? "")) {
      const nums = line.match(IT_AMOUNT_RE);
      if (nums && nums.length >= 3) {
        godCols = [
          parseItalianAmount(nums[0]!),
          parseItalianAmount(nums[1]!),
          parseItalianAmount(nums[2]!),
        ];
      }
    }
  }

  // Godute AP anche fuori tabella (riga data + Ore), come plain parser
  if (godCols.every((c) => c == null)) {
    const godute = md.match(
      /\d{1,2}\/\d{1,2}\/\d{4}\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*\n\s*Ore/i,
    );
    if (godute) {
      godCols = [
        parseItalianAmount(godute[1]!),
        parseItalianAmount(godute[2]!),
        parseItalianAmount(godute[3]!),
      ];
    }
  }

  if (!gridNums || gridNums.length < 9) return null;

  const triples: number[][] = [
    gridNums.slice(0, 3),
    gridNums.slice(3, 6),
    gridNums.slice(6, 9),
  ];

  const byKind: Record<LeaveKind, PayslipLeave> = {
    ferie: empty,
    fest: empty,
    perm: empty,
  };

  for (let i = 0; i < 3; i++) {
    const kind = order[i]!;
    byKind[kind] = splitLeaveTriple(triples[i]!, resCols[i] ?? null, godCols[i] ?? null);
  }

  return normalizeAfeaLeaveColumns(
    {
      leaveFerie: byKind.ferie,
      leaveFest: byKind.fest,
      leavePerm: byKind.perm,
    },
    order,
  );
}

/**
 * Parser MD-first (output anydoc/GFM): tabelle per leave, strip + regex per importi.
 */
export function parseOsraPayslipMarkdown(md: string, sourceFile?: string): PayslipRecord | null {
  const leaveFromMd = parseLeaveFromMarkdownTables(md);
  const plainish = stripMarkdownNoise(md);
  const base = parseOsraPayslipText(plainish, sourceFile);
  if (!base) return null;
  return {
    ...base,
    ...(leaveFromMd ?? {}),
    parserVersion: PAYSLIP_PARSER_VERSION,
  };
}

/**
 * Entry point: sceglie parser MD o plain in base al kind di estrazione.
 */
export function parsePayslipContent(
  content: string,
  kind: PayslipContentKind,
  sourceFile?: string,
): PayslipRecord | null {
  if (kind === "md") {
    return (
      parseOsraPayslipMarkdown(content, sourceFile) ??
      parseOsraPayslipText(stripMarkdownNoise(content), sourceFile)
    );
  }
  return parseOsraPayslipText(content, sourceFile);
}

/**
 * Netto cedolino: Acc. c.c. se coerente col calcolato, altrimenti calcolato + flag anomalia.
 */
export function resolvePayslipNet(input: {
  netToAccount: number | null;
  taxableIncome: number | null;
  taxWithheld: number | null;
  socialWithheld: number | null;
}): { payslipNet: number | null; accAnomalous: boolean } {
  const { netToAccount, taxableIncome, taxWithheld, socialWithheld } = input;
  // Social può mancare su cedolini corti (es. primi mesi); conguaglio dicembre senza rit. mensile.
  const computed =
    taxableIncome != null && taxWithheld != null
      ? round2(taxableIncome - taxWithheld - (socialWithheld ?? 0))
      : null;

  if (netToAccount != null && computed != null) {
    if (near(netToAccount, computed)) {
      return { payslipNet: netToAccount, accAnomalous: false };
    }
    // Acc. c.c. spesso è solo un acconto/riga parziale (≪ netto): ignora, non flaggare anomalia
    if (netToAccount < computed * 0.5) {
      return { payslipNet: computed, accAnomalous: false };
    }
    return { payslipNet: computed, accAnomalous: true };
  }
  if (netToAccount != null) return { payslipNet: netToAccount, accAnomalous: false };
  if (computed != null) return { payslipNet: computed, accAnomalous: false };
  return { payslipNet: null, accAnomalous: false };
}

/**
 * Parsa testo busta OSRA / Wolters Kluwer OLUIT (AFEA / ITWorking).
 * @param sourceFile - Nome PDF origine per tracciabilità
 */
export function parseOsraPayslipText(text: string, sourceFile?: string): PayslipRecord | null {
  if (!/OSRA|OLUIT|Wolters Kluwer/i.test(text)) return null;

  const period = text.match(/(\d{2})\/(\d{4})\s*-\s*(\S+)/);
  if (!period) return null;

  const periodMonthRaw = Number(period[1]);
  const periodYear = Number(period[2]);
  const periodLabel = period[3]!;
  const periodMonth = /tredicesima/i.test(periodLabel) ? 13 : periodMonthRaw;
  if (periodMonthRaw < 1 || periodMonthRaw > 12) return null;
  if (periodMonth !== 13 && (periodMonth < 1 || periodMonth > 12)) return null;

  const grossTotal = amt(text, /999 TOT\.LORDO SOGG\.CONTR\s+([\d.,]+)/);
  const taxableIncome = amt(text, /Imponibile Fiscale\s+([\d.,]+)/);
  const taxCredito = amt(text, /Rit\.Fis\.\s*credito\s+([\d.,]+)/i);
  const taxWithheld =
    amt(text, /Rit\. Fis\. mese lorda\s+([\d.,]+)/) ??
    amt(text, /Rit\.Fis\.\s*conguaglio\s+([\d.,]+)/i) ??
    (taxCredito != null ? round2(-taxCredito) : null);
  const taxWithheldNet = amt(text, /Rit\. Fis\. mese netta\s+([\d.,]+)/);
  const socialWithheld = amt(text, /Tot\. rit\. sociali\s+([\d.,]+)/);

  const acc = text.match(
    /Acc\.\s*c\.c\.\s*n\.:\s*\d+\s+BANCA\s+MEDIOLANUM(?:\s+S\.?P\.?A\.?)?[^\d\n]*([\d.,]+)\s+([\d.,]+)/i,
  );
  const netToAccount = acc?.[1] ? parseItalianAmount(acc[1]) : null;
  const totalCompetenze = acc?.[2] ? parseItalianAmount(acc[2]) : null;

  const payDate = parseItDate(text.match(/Data valuta\s*:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? "");

  const { leaveFest, leaveFerie, leavePerm } = parseLeaveGrid(text);
  const { payslipNet, accAnomalous } = resolvePayslipNet({
    netToAccount,
    taxableIncome,
    taxWithheld,
    socialWithheld,
  });

  const id = `osra-${periodYear}-${String(periodMonth).padStart(2, "0")}-${slugLabel(periodLabel)}`;

  return {
    id,
    periodYear,
    periodMonth,
    periodLabel,
    payDate,
    grossTotal,
    taxableIncome,
    taxWithheld,
    taxWithheldNet,
    socialWithheld,
    netToAccount,
    totalCompetenze,
    payslipNet,
    netPay: payslipNet,
    bankCredit: null,
    bankMatchStatus: "missing",
    accAnomalous,
    leaveFest,
    leaveFerie,
    leavePerm,
    sourceFile: sourceFile ?? null,
    importedAt: new Date().toISOString(),
    parserVersion: PAYSLIP_PARSER_VERSION,
  };
}

function isStipendCredit(t: Transaction): boolean {
  return (
    t.source === "mediolanum" &&
    t.amount > 0 &&
    (t.category === "Stipendio" || /emolument|stipend|sala stipend/i.test(t.description))
  );
}

/**
 * Cerca accrediti stipendio Mediolanum vicino a payDate (±5g) o nel mese competenza.
 * Preferisce il singolo movimento più vicino al netto cedolino; somma solo se il totale matcha.
 */
export function matchBankCredit(
  transactions: Transaction[],
  opts: {
    payDate: string | null;
    periodYear: number;
    periodMonth: number;
    payslipNet: number | null;
  },
): { bankCredit: number | null; status: BankMatchStatus } {
  const { payDate, periodYear, periodMonth, payslipNet } = opts;

  const hits = transactions.filter((t) => {
    if (!isStipendCredit(t)) return false;
    if (payDate) return daysBetween(t.date, payDate) <= 5;
    if (periodMonth === 13) {
      return t.date.startsWith(`${periodYear}-12`);
    }
    const prefix = `${periodYear}-${String(periodMonth).padStart(2, "0")}`;
    return t.date.startsWith(prefix);
  });

  if (hits.length === 0) return { bankCredit: null, status: "missing" };

  if (payslipNet != null) {
    const closest = hits.reduce((a, b) =>
      Math.abs(a.amount - payslipNet) <= Math.abs(b.amount - payslipNet) ? a : b,
    );
    const closestAmt = round2(closest.amount);
    if (near(closestAmt, payslipNet)) {
      return { bankCredit: closestAmt, status: "matched" };
    }
    const sum = round2(hits.reduce((s, t) => s + t.amount, 0));
    if (hits.length > 1 && near(sum, payslipNet)) {
      return { bankCredit: sum, status: "matched" };
    }
    return { bankCredit: closestAmt, status: "doubt" };
  }

  const bankCredit = round2(hits.reduce((s, t) => s + t.amount, 0));
  return { bankCredit, status: "doubt" };
}

/** Imposta bankCredit/status e netPay KPI (banca solo se matched). */
export function enrichPayslipWithBank(payslip: PayslipRecord, transactions: Transaction[]): PayslipRecord {
  const { bankCredit, status } = matchBankCredit(transactions, {
    payDate: payslip.payDate,
    periodYear: payslip.periodYear,
    periodMonth: payslip.periodMonth,
    payslipNet: payslip.payslipNet,
  });
  const netPay = status === "matched" && bankCredit != null ? bankCredit : payslip.payslipNet;
  return { ...payslip, bankCredit, bankMatchStatus: status, netPay };
}

/** True se nessuna ore ferie/fest/perm (né AP/AC né totale). */
export function payslipLeaveEmpty(p: PayslipRecord): boolean {
  const empty = (leave: PayslipLeave) =>
    leave.residue == null &&
    leave.spettanti == null &&
    leave.godute == null &&
    leave.ap.residue == null &&
    leave.ap.spettanti == null &&
    leave.ac.residue == null &&
    leave.ac.spettanti == null;
  return empty(p.leaveFerie) && empty(p.leavePerm) && empty(p.leaveFest);
}

/**
 * Cedolino da riparsare: versione parser vecchia, lordo “34” anydoc, o lordo ok ma leave/netto vuoti.
 */
export function payslipNeedsReparse(p: PayslipRecord): boolean {
  if (p.parserVersion !== PAYSLIP_PARSER_VERSION) return true;
  // Anydoc glue: TOT.LORDO cattura codice riga (es. 34 CONTRIB.FAP)
  if (p.grossTotal != null && p.grossTotal > 0 && p.grossTotal < 50) return true;
  if (p.grossTotal != null && p.grossTotal >= 500 && payslipLeaveEmpty(p)) return true;
  if (p.taxableIncome != null && p.taxableIncome >= 100 && p.payslipNet == null) return true;
  return false;
}

function periodKey(p: PayslipRecord): string {
  return `${p.periodYear}-${String(p.periodMonth).padStart(2, "0")}`;
}

/**
 * Ordina buste, calcola medie ultimi 6 mesi e payload grafici.
 * @param transactions - Movimenti per arricchimento bankCredit
 */
export function buildPayslipSummary(
  payslips: PayslipRecord[],
  transactions: Transaction[] = [],
): PayslipSummary {
  const enriched = payslips
    .map((p) => enrichPayslipWithBank(p, transactions))
    .sort((a, b) => periodKey(a).localeCompare(periodKey(b)) || a.periodLabel.localeCompare(b.periodLabel));

  const latest = enriched.at(-1) ?? null;
  const last6 = enriched.filter((p) => p.netPay != null).slice(-6);
  const avgNet6 =
    last6.length > 0 ? round2(last6.reduce((s, p) => s + (p.netPay ?? 0), 0) / last6.length) : null;
  const gross6 = last6.filter((p) => p.grossTotal != null);
  const avgGross6 =
    gross6.length > 0
      ? round2(gross6.reduce((s, p) => s + (p.grossTotal ?? 0), 0) / gross6.length)
      : null;

  return {
    payslips: enriched,
    latest,
    avgNet6,
    avgGross6,
    chartNet: enriched.map((p) => ({
      period: `${String(p.periodMonth).padStart(2, "0")}/${p.periodYear}`,
      netPay: p.netPay ?? 0,
      grossTotal: p.grossTotal,
      bankCredit: p.bankCredit,
    })),
    chartLeave: enriched.map((p) => ({
      period: `${String(p.periodMonth).padStart(2, "0")}/${p.periodYear}`,
      ferieResidueAp: p.leaveFerie.ap.residue,
      ferieResidueAc: p.leaveFerie.ac.residue,
      permResidueAp: p.leavePerm.ap.residue,
      permResidueAc: p.leavePerm.ac.residue,
      festResidueAp: p.leaveFest.ap.residue,
      festResidueAc: p.leaveFest.ac.residue,
    })),
  };
}
