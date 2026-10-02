/**
 * Motore consigli “advisor” rule-based (score 0–100, insight leak/warn/info).
 *
 * Combina consumo filtrato, ricorrenti, mutui, PayPal, budget e patrimonio opzionale;
 * nessuna chiamata LLM esterna — output per card dashboard.
 */
import type { Period, RecurringMark, Transaction } from "../types";
import type { LoanTarget } from "./loans";
import { forConsumption } from "./consumptionView";
import { buildLoanSummary } from "./loans";
import { mergeLoanTargets } from "./knownLoans";
import { findRecurring, isSubscriptionLike } from "./recurring";
import { buildPaypalSummary, type PaypalTarget } from "./paypal";
import {
  categoryBreakdown,
  computeKpis,
  filterByPeriod,
  formatEur,
  monthlySeries,
} from "./stats";
import { buildBudgetReport, type CategoryBudgets } from "./budget";

export type InsightSeverity = "info" | "warn" | "leak";
export type InsightKind = "recurring" | "anomaly" | "cashflow" | "patrimonio";

/** Snapshot portafoglio investimenti per insight patrimonio. */
export type PortfolioSnapshot = {
  totalContributed: number;
  totalValue: number;
  pnl: number;
};

/** Singolo messaggio advisor con severità e azione suggerita. */
export type Insight = {
  id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  detail: string;
  /** Stima impatto EUR (mensile o stock) */
  impactEur?: number;
  action?: string;
};

/** Debiti e carico fisso mensile aggregato. */
export type ImpegniSnapshot = {
  /** Stock/all-time — not filtered by advisor period */
  scope: "all";
  paypalDebt: number;
  paypalMonthly: number;
  loanDebt: number;
  loanMonthly: number;
  recurringMonthly: number;
  monthlyBurden: number;
};

/** Report completo advisor per periodo selezionato. */
export type AdvisorReport = {
  score: number;
  label: string;
  scoreDelta: number | null;
  insights: Insight[];
  topActions: Insight[];
  summary: {
    income: number;
    expense: number;
    net: number;
    savingsRate: number;
    avgMonthlyIncome: number;
  };
  impegni: ImpegniSnapshot;
};

const PENALTY_CAP: Record<InsightKind, number> = {
  recurring: 22,
  anomaly: 18,
  cashflow: 24,
  patrimonio: 6,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function severityRank(s: InsightSeverity): number {
  return s === "leak" ? 3 : s === "warn" ? 2 : 1;
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Solido";
  if (score >= 60) return "Ok, con attenzione";
  if (score >= 40) return "Leak probabili";
  return "Pressione alta";
}

function avgMonthlyIncome(cash: Transaction[]): number {
  const months = monthlySeries(cash);
  if (months.length === 0) return 0;
  const total = months.reduce((s, m) => s + m.income, 0);
  return round2(total / months.length);
}

function paypalKindLabel(kind: string): string {
  if (kind === "pay_in_3") return "Paga in 3";
  if (kind === "pay_monthly") return "Pay Monthly";
  if (kind === "sdd") return "Addebito PayPal (SDD)";
  return "Altro PayPal";
}

function paypalActiveKindsLabel(
  txns: Transaction[],
  paypalTargets: Record<string, PaypalTarget> = {},
): string {
  const paypal = buildPaypalSummary(txns, paypalTargets);
  const labels = [
    ...new Set(
      paypal.plans
        .filter((p) => p.status === "active")
        .map((p) => paypalKindLabel(p.kind)),
    ),
  ];
  return labels.length > 0 ? labels.join(" · ") : "piani PayPal";
}

function buildImpegni(
  txns: Transaction[],
  marks: Record<string, RecurringMark>,
  loanTargets: Record<string, LoanTarget>,
  paypalTargets: Record<string, PaypalTarget> = {},
): ImpegniSnapshot {
  const paypal = buildPaypalSummary(txns, paypalTargets);
  const loans = buildLoanSummary(txns, mergeLoanTargets(loanTargets));
  const recurringMonthly = findRecurring(txns)
    .filter(isSubscriptionLike)
    .filter((r) => marks[r.key] !== "cancelled")
    .reduce((s, r) => s + r.monthlyEstimate, 0);
  const loanMonthly = loans.monthlyBurden;
  const paypalMonthly = paypal.monthlyBurden;
  return {
    scope: "all",
    paypalDebt: paypal.remainingDebt,
    paypalMonthly,
    loanDebt: loans.remainingDebt,
    loanMonthly,
    recurringMonthly: round2(recurringMonthly),
    monthlyBurden: round2(recurringMonthly + loanMonthly + paypalMonthly),
  };
}

type PenaltyLedger = Record<InsightKind, number>;

function addPenalty(ledger: PenaltyLedger, kind: InsightKind, amount: number): void {
  ledger[kind] = Math.min(PENALTY_CAP[kind], ledger[kind] + amount);
}

function totalPenalty(ledger: PenaltyLedger): number {
  return ledger.recurring + ledger.anomaly + ledger.cashflow + ledger.patrimonio;
}

/**
 * Analizza finanze e produce score + insight ranked.
 * @param opts.period - Finestra KPI (default 3m)
 * @param opts.skipScoreDelta - Evita ricorsione nel calcolo delta mese precedente
 */
export function analyzeFinances(
  txns: Transaction[],
  opts: {
    recurringMarks?: Record<string, RecurringMark>;
    loanTargets?: Record<string, LoanTarget>;
    paypalTargets?: Record<string, PaypalTarget>;
    categoryBudgets?: CategoryBudgets;
    period?: Period;
    portfolio?: PortfolioSnapshot | null;
    now?: Date;
    skipScoreDelta?: boolean;
  } = {},
): AdvisorReport {
  const marks = opts.recurringMarks ?? {};
  const loanTargets = opts.loanTargets ?? {};
  const paypalTargets = opts.paypalTargets ?? {};
  const categoryBudgets = opts.categoryBudgets ?? {};
  const period = opts.period ?? "3m";
  const portfolio = opts.portfolio ?? null;
  const now = opts.now ?? new Date();

  const filtered = forConsumption(filterByPeriod(txns, period, now));
  const kpis = computeKpis(filtered);
  const avgIncome = avgMonthlyIncome(filtered);
  const savingsRate =
    kpis.income > 0 ? round2((kpis.net / kpis.income) * 100) : 0;

  const insights: Insight[] = [];
  const ledger: PenaltyLedger = { recurring: 0, anomaly: 0, cashflow: 0, patrimonio: 0 };
  let bonus = 0;

  const impegni = buildImpegni(txns, marks, loanTargets, paypalTargets);
  const { recurringMonthly, loanMonthly, paypalMonthly, monthlyBurden, paypalDebt, loanDebt } =
    impegni;

  const recurring = findRecurring(filtered);
  const activeRecurring = recurring.filter((r) => marks[r.key] !== "cancelled");
  const subscriptionLike = activeRecurring.filter(isSubscriptionLike);
  const couldCancel = activeRecurring.filter((r) => marks[r.key] === "could_cancel");
  const couldCancelSum = couldCancel.reduce((s, r) => s + r.monthlyEstimate, 0);

  // --- Ricorrenti / abbonamenti ---
  if (avgIncome > 0 && recurringMonthly / avgIncome > 0.25) {
    const pct = round2((100 * recurringMonthly) / avgIncome);
    insights.push({
      id: "recurring-heavy",
      kind: "recurring",
      severity: "leak",
      title: "Ricorrenti pesanti sul reddito",
      detail: `${formatEur(recurringMonthly)}/mese di abbonamenti ≈ ${pct}% delle entrate medie nel periodo.`,
      impactEur: recurringMonthly,
      action: "Apri Abbonamenti e segna cosa puoi tagliare.",
    });
    addPenalty(ledger, "recurring", 18);
  } else if (avgIncome > 0 && recurringMonthly / avgIncome > 0.15) {
    insights.push({
      id: "recurring-moderate",
      kind: "recurring",
      severity: "warn",
      title: "Ricorrenti rilevanti",
      detail: `${formatEur(recurringMonthly)}/mese fissi (~${round2((100 * recurringMonthly) / avgIncome)}% entrate medie).`,
      impactEur: recurringMonthly,
      action: "Controlla Abbonamenti per eventuali doppioni.",
    });
    addPenalty(ledger, "recurring", 8);
  }

  if (couldCancel.length > 0) {
    insights.push({
      id: "could-cancel",
      kind: "recurring",
      severity: "info",
      title: "Hai già segnalato tagli possibili",
      detail: `${couldCancel.length} voci · potenziale ${formatEur(couldCancelSum)}/mese.`,
      impactEur: couldCancelSum,
      action: "Conferma cancellazione quando l’hai fatta.",
    });
  }

  const unmarkedHeavy = subscriptionLike
    .filter((r) => !marks[r.key] && r.monthlyEstimate >= 20)
    .slice(0, 3);
  if (unmarkedHeavy.length >= 2) {
    insights.push({
      id: "review-subs",
      kind: "recurring",
      severity: "warn",
      title: "Abbonamenti da revisionare",
      detail: unmarkedHeavy.map((r) => `${r.label} (${formatEur(r.monthlyEstimate)})`).join(" · "),
      impactEur: unmarkedHeavy.reduce((s, r) => s + r.monthlyEstimate, 0),
      action: "In Abbonamenti marca “potrei tagliare” o “cancellato”.",
    });
    addPenalty(ledger, "recurring", 6);
  }

  // --- Anomalie nel periodo selezionato ---
  const months = monthlySeries(filtered);
  const lastMonth = months.length > 0 ? months[months.length - 1]!.month : null;
  const thisMonthTx =
    lastMonth != null ? filtered.filter((t) => t.date.startsWith(lastMonth)) : filtered;
  const priorTx =
    lastMonth != null ? filtered.filter((t) => !t.date.startsWith(lastMonth)) : [];

  const thisExp = categoryBreakdown(thisMonthTx);
  const priorExp = categoryBreakdown(priorTx);
  const priorByCat = new Map(priorExp.map((c) => [c.category, c.total]));
  const priorMonthCount =
    new Set(priorTx.filter((t) => t.amount < 0).map((t) => t.date.slice(0, 7))).size || 1;

  for (const row of thisExp.slice(0, 8)) {
    if (row.category === "Altro") continue;
    const hist = (priorByCat.get(row.category) ?? 0) / priorMonthCount;
    if (hist >= 30 && row.total > hist * 1.75) {
      insights.push({
        id: `spike-${row.category}`,
        kind: "anomaly",
        severity: "warn",
        title: `Spike: ${row.category}`,
        detail: `${lastMonth ?? "Periodo"}: ${formatEur(row.total)} vs media ~${formatEur(hist)}/mese.`,
        impactEur: round2(row.total - hist),
        action: "Verifica in Movimenti se è one-off o nuova abitudine.",
      });
      addPenalty(ledger, "anomaly", 5);
    }
  }

  const altro = categoryBreakdown(filtered).find((c) => c.category === "Altro");
  const periodExpTotal = kpis.expense || 1;
  if (altro && altro.total / periodExpTotal > 0.25 && altro.total > 50) {
    insights.push({
      id: "uncategorized",
      kind: "anomaly",
      severity: "warn",
      title: "Troppe uscite in “Altro”",
      detail: `${formatEur(altro.total)} (${round2((100 * altro.total) / periodExpTotal)}% del periodo) senza categoria utile.`,
      impactEur: altro.total,
      action: "In Movimenti assegna categorie più precise.",
    });
    addPenalty(ledger, "anomaly", 7);
  }

  const cashOuts = filtered.filter(
    (t) =>
      t.amount < 0 &&
      (/prelievo|atm|maxiprelievo|contante/i.test(t.description) || t.category === "Prelievi"),
  );
  const cashSum = round2(cashOuts.reduce((s, t) => s + -t.amount, 0));
  if (cashSum > 400 && kpis.income > 0 && cashSum / kpis.income > 0.12) {
    insights.push({
      id: "cash-heavy",
      kind: "anomaly",
      severity: "leak",
      title: "Molto contante / prelievi",
      detail: `${formatEur(cashSum)} in prelievi nel periodo — difficile da tracciare.`,
      impactEur: cashSum,
      action: "Preferisci carta dove puoi, o annota a cosa serve il cash.",
    });
    addPenalty(ledger, "anomaly", 10);
  }

  const bigOnes = filtered
    .filter((t) => t.amount < -150)
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 3);
  if (bigOnes.length > 0 && kpis.expense > 0) {
    const top = bigOnes[0]!;
    if (-top.amount > kpis.expense * 0.15) {
      insights.push({
        id: "large-hit",
        kind: "anomaly",
        severity: "info",
        title: "Uscita straordinaria rilevante",
        detail: `${top.date} · ${top.description} · ${formatEur(top.amount)}`,
        impactEur: -top.amount,
        action: "Se è one-off, ok; se si ripete, mettila nei ricorrenti.",
      });
    }
  }

  // --- Cash flow / impegni ---
  if (avgIncome > 0 && monthlyBurden / avgIncome > 0.35) {
    insights.push({
      id: "commitments-monthly-high",
      kind: "cashflow",
      severity: "leak",
      title: "Impegni mensili alti vs entrate",
      detail: `Rate mutui ${formatEur(loanMonthly)} + ricorrenti ${formatEur(recurringMonthly)} + PayPal ${formatEur(paypalMonthly)} = ${formatEur(monthlyBurden)}/mese (~${round2((100 * monthlyBurden) / avgIncome)}% entrate medie).`,
      impactEur: monthlyBurden,
      action: "Evita nuovi abbonamenti finché non alleggerisci il carico.",
    });
    addPenalty(ledger, "cashflow", 14);
  }

  if (avgIncome > 0 && loanMonthly / avgIncome > 0.2) {
    insights.push({
      id: "loan-burden-high",
      kind: "cashflow",
      severity: "warn",
      title: "Rate mutui pesanti",
      detail: `${formatEur(loanMonthly)}/mese in finanziamenti (~${round2((100 * loanMonthly) / avgIncome)}% entrate medie).`,
      impactEur: loanMonthly,
      action: "Apri Mutui per residuo e scadenze.",
    });
    addPenalty(ledger, "cashflow", 8);
  }

  const debtStock = round2(paypalDebt + loanDebt);
  if (avgIncome > 0 && debtStock > avgIncome * 6) {
    insights.push({
      id: "debt-stock-high",
      kind: "cashflow",
      severity: "warn",
      title: "Debito residuo elevato",
      detail: `PayPal ${formatEur(paypalDebt)} + mutui ${formatEur(loanDebt)} = ${formatEur(debtStock)} (>${formatEur(avgIncome * 6)} ≈ 6× entrate medie).`,
      impactEur: debtStock,
      action: "Priorità: chiudere piani PayPal e monitorare estinzione mutui.",
    });
    addPenalty(ledger, "cashflow", 7);
  } else if (paypalDebt > 100) {
    insights.push({
      id: "paypal-debt",
      kind: "cashflow",
      severity: "warn",
      title: "Rate PayPal ancora aperte",
      detail: `Debito stimato ${formatEur(paypalDebt)} su ${paypalActiveKindsLabel(txns, paypalTargets)}.`,
      impactEur: paypalDebt,
      action: "Apri tab PayPal per lo stato rate.",
    });
    addPenalty(ledger, "cashflow", 5);
  }

  if (loanDebt > 5000) {
    insights.push({
      id: "loan-residual",
      kind: "cashflow",
      severity: "info",
      title: "Mutui con residuo significativo",
      detail: `Debito residuo stimato ${formatEur(loanDebt)} su finanziamenti attivi.`,
      impactEur: loanDebt,
      action: "Apri Mutui per dettaglio contratti e rate.",
    });
  }

  if (kpis.income > 0 && savingsRate < 5) {
    insights.push({
      id: "savings-low",
      kind: "cashflow",
      severity: "leak",
      title: "Savings rate molto basso",
      detail: `Risparmi ~${savingsRate}% nel periodo (netto ${formatEur(kpis.net)}).`,
      action: "Taglia 1–2 ricorrenti o riduci la categoria più cara.",
    });
    addPenalty(ledger, "cashflow", 16);
  } else if (kpis.income > 0 && savingsRate < 15) {
    insights.push({
      id: "savings-mid",
      kind: "cashflow",
      severity: "warn",
      title: "Margine di risparmio stretto",
      detail: `Savings rate ${savingsRate}% nel periodo. Un imprevisto può mettere in rosso il mese.`,
      action: "Obiettivo soft: avvicinarsi al 20%.",
    });
    addPenalty(ledger, "cashflow", 8);
  } else if (kpis.income > 0 && savingsRate >= 20) {
    insights.push({
      id: "savings-ok",
      kind: "cashflow",
      severity: "info",
      title: "Buon ritmo di risparmio",
      detail: `Savings rate ${savingsRate}% nel periodo — tieni d’occhio impegni e mutui.`,
    });
    bonus += 4;
  }

  const redMonths = months.filter((m) => m.net < 0);
  if (redMonths.length >= 2) {
    insights.push({
      id: "red-months",
      kind: "cashflow",
      severity: "warn",
      title: "Più mesi in rosso",
      detail: `${redMonths.length} mesi con netto negativo (${redMonths.map((m) => m.month.slice(5)).join(", ")}).`,
      action: "Confronta entrate vs uscite in quei mesi sulla Dashboard.",
    });
    addPenalty(ledger, "cashflow", 9);
  } else if (months.length >= 2 && redMonths.length === 0) {
    bonus += 2;
  }

  if (filtered.length < 15) {
    insights.push({
      id: "thin-data",
      kind: "cashflow",
      severity: "info",
      title: "Pochi movimenti per un consiglio fine",
      detail: "Importa più mesi di CSV o allarga il periodo per analisi più affidabili.",
    });
  }

  // --- Budget mese corrente (indipendente dal periodo advisor) ---
  if (Object.keys(categoryBudgets).length > 0) {
    const budget = buildBudgetReport(txns, categoryBudgets, now);
    const flagged = budget.rows.filter((r) => r.status !== "ok").slice(0, 4);
    for (const row of flagged) {
      const over = row.status === "over";
      insights.push({
        id: `budget-${row.category}`,
        kind: "cashflow",
        severity: over ? "leak" : "warn",
        title: over
          ? `Budget ${row.category} superato`
          : `Budget ${row.category} al ${row.pct.toFixed(0)}%`,
        detail: `${formatEur(row.spent)} su ${formatEur(row.limit)} questo mese (${budget.month}).`,
        impactEur: over ? round2(row.spent - row.limit) : row.spent,
        action: "Apri Budget e rivedi il limite o la spesa.",
      });
      addPenalty(ledger, "cashflow", over ? 10 : 5);
    }
  }

  // --- Patrimonio investimenti (opzionale) ---
  if (portfolio && portfolio.totalContributed > 0) {
    if (savingsRate < 10 && kpis.income > 0) {
      insights.push({
        id: "invest-low-savings",
        kind: "patrimonio",
        severity: "warn",
        title: "PAC attivo ma margine stretto",
        detail: `Versato ${formatEur(portfolio.totalContributed)} in investimenti con savings rate ${savingsRate}% nel periodo.`,
        impactEur: portfolio.totalContributed,
        action: "Verifica che i versamenti PAC siano sostenibili col cash flow.",
      });
      addPenalty(ledger, "patrimonio", 4);
    } else if (savingsRate >= 15) {
      insights.push({
        id: "invest-on-track",
        kind: "patrimonio",
        severity: "info",
        title: "Risparmio e investimenti in equilibrio",
        detail: `Savings ${savingsRate}% · patrimonio investito ${formatEur(portfolio.totalValue)}.`,
      });
    }

    if (
      portfolio.pnl < -portfolio.totalContributed * 0.1 &&
      portfolio.totalValue > 200
    ) {
      insights.push({
        id: "invest-pnl-down",
        kind: "patrimonio",
        severity: "info",
        title: "Controvalore sotto il versato",
        detail: `P&L ${formatEur(portfolio.pnl)} su ${formatEur(portfolio.totalContributed)} versati — orizzonte lungo.`,
        action: "Controlla in Investimenti; la volatilità PAC è normale a breve.",
      });
    }
  }

  const ranked = insights
    .sort((a, b) => {
      const sr = severityRank(b.severity) - severityRank(a.severity);
      if (sr !== 0) return sr;
      return (b.impactEur ?? 0) - (a.impactEur ?? 0);
    })
    .slice(0, 10);

  const topActions = ranked
    .filter((i) => i.severity !== "info" && i.action)
    .slice(0, 3);

  const score = Math.max(0, Math.min(100, 100 - totalPenalty(ledger) + bonus));
  const scoreDelta = opts.skipScoreDelta
    ? null
    : computeScoreDelta(txns, opts, score, now);

  return {
    score,
    label: scoreLabel(score),
    scoreDelta,
    insights: ranked,
    topActions,
    summary: {
      income: kpis.income,
      expense: kpis.expense,
      net: kpis.net,
      savingsRate,
      avgMonthlyIncome: avgIncome,
    },
    impegni,
  };
}

function computeScoreDelta(
  txns: Transaction[],
  opts: {
    recurringMarks?: Record<string, RecurringMark>;
    loanTargets?: Record<string, LoanTarget>;
    paypalTargets?: Record<string, PaypalTarget>;
    categoryBudgets?: CategoryBudgets;
    period?: Period;
    portfolio?: PortfolioSnapshot | null;
  },
  currentScore: number,
  now: Date,
): number | null {
  const period = opts.period ?? "3m";
  if (period !== "month" && period !== "30d") return null;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const prevReport = analyzeFinances(txns, { ...opts, now: prev, skipScoreDelta: true });
  if (prevReport.summary.income === 0 && prevReport.summary.expense === 0) return null;
  return currentScore - prevReport.score;
}

/** Etichetta italiana categoria insight per UI. */
export function kindLabel(kind: InsightKind): string {
  if (kind === "recurring") return "Ricorrenti";
  if (kind === "anomaly") return "Anomalie";
  if (kind === "patrimonio") return "Patrimonio";
  return "Cash flow";
}
