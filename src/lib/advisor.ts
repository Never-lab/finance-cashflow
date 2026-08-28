import type { RecurringMark, Transaction } from "../types";
import { forCashflow } from "./internal";
import { findRecurring, isSubscriptionLike } from "./recurring";
import { buildPaypalSummary } from "./paypal";
import { categoryBreakdown, computeKpis, formatEur, monthlySeries } from "./stats";

export type InsightSeverity = "info" | "warn" | "leak";
export type InsightKind = "recurring" | "anomaly" | "cashflow";

export type Insight = {
  id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  detail: string;
  /** Optional euro impact estimate */
  impactEur?: number;
  action?: string;
};

export type AdvisorReport = {
  score: number; // 0-100, higher = healthier
  label: string;
  insights: Insight[];
  summary: {
    income: number;
    expense: number;
    net: number;
    savingsRate: number;
  };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Local rule-based leak / advice engine (no external AI). */
export function analyzeFinances(
  txns: Transaction[],
  opts: {
    recurringMarks?: Record<string, RecurringMark>;
    now?: Date;
  } = {},
): AdvisorReport {
  const marks = opts.recurringMarks ?? {};
  const now = opts.now ?? new Date();
  const cash = forCashflow(txns);
  const kpis = computeKpis(cash);
  const savingsRate =
    kpis.income > 0 ? round2((kpis.net / kpis.income) * 100) : 0;

  const insights: Insight[] = [];
  let penalty = 0;

  const recurring = findRecurring(cash);
  const activeRecurring = recurring.filter((r) => marks[r.key] !== "cancelled");
  const subscriptionLike = activeRecurring.filter(isSubscriptionLike);
  const recurringBurden = subscriptionLike.reduce((s, r) => s + r.monthlyEstimate, 0);
  const couldCancel = activeRecurring.filter((r) => marks[r.key] === "could_cancel");
  const couldCancelSum = couldCancel.reduce((s, r) => s + r.monthlyEstimate, 0);

  // --- Recurring / subscriptions ---
  if (kpis.income > 0 && recurringBurden / kpis.income > 0.25) {
    const pct = round2((100 * recurringBurden) / kpis.income);
    insights.push({
      id: "recurring-heavy",
      kind: "recurring",
      severity: "leak",
      title: "Ricorrenti pesanti sul reddito",
      detail: `${formatEur(recurringBurden)}/mese di uscite ripetute ≈ ${pct}% delle entrate totali nel dataset.`,
      impactEur: recurringBurden,
      action: "Apri Abbonamenti e segna cosa puoi tagliare.",
    });
    penalty += 18;
  } else if (kpis.income > 0 && recurringBurden / kpis.income > 0.15) {
    insights.push({
      id: "recurring-moderate",
      kind: "recurring",
      severity: "warn",
      title: "Ricorrenti rilevanti",
      detail: `${formatEur(recurringBurden)}/mese fissi (~${round2((100 * recurringBurden) / kpis.income)}% entrate).`,
      impactEur: recurringBurden,
      action: "Controlla Abbonamenti per eventuali doppioni.",
    });
    penalty += 8;
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
    penalty += 6;
  }

  // --- Anomalies ---
  const month = currentMonth(now);
  const thisMonth = cash.filter((t) => t.date.startsWith(month));
  const prior = cash.filter((t) => !t.date.startsWith(month));
  const thisExp = categoryBreakdown(thisMonth);
  const priorExp = categoryBreakdown(prior);
  const priorByCat = new Map(priorExp.map((c) => [c.category, c.total]));
  const priorMonths = new Set(prior.filter((t) => t.amount < 0).map((t) => t.date.slice(0, 7))).size || 1;

  for (const row of thisExp.slice(0, 8)) {
    if (row.category === "Altro") continue;
    const hist = (priorByCat.get(row.category) ?? 0) / priorMonths;
    if (hist >= 30 && row.total > hist * 1.75) {
      insights.push({
        id: `spike-${row.category}`,
        kind: "anomaly",
        severity: "warn",
        title: `Spike: ${row.category}`,
        detail: `Questo mese ${formatEur(row.total)} vs media storica ~${formatEur(hist)}/mese.`,
        impactEur: round2(row.total - hist),
        action: "Verifica in Movimenti se è one-off o nuova abitudine.",
      });
      penalty += 5;
    }
  }

  const altro = thisExp.find((c) => c.category === "Altro");
  const monthExpTotal = thisExp.reduce((s, c) => s + c.total, 0) || 1;
  if (altro && altro.total / monthExpTotal > 0.25 && altro.total > 50) {
    insights.push({
      id: "uncategorized",
      kind: "anomaly",
      severity: "warn",
      title: "Troppe uscite in “Altro”",
      detail: `${formatEur(altro.total)} (${round2((100 * altro.total) / monthExpTotal)}% del mese) senza categoria utile.`,
      impactEur: altro.total,
      action: "In Movimenti assegna categorie più precise.",
    });
    penalty += 7;
  }

  const cashOuts = cash.filter(
    (t) => t.amount < 0 && (/prelievo|atm|maxiprelievo|contante/i.test(t.description) || t.category === "Prelievi"),
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
    penalty += 10;
  }

  const bigOnes = cash
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

  // --- Cash flow / commitments ---
  const paypal = buildPaypalSummary(txns);
  const commitments = round2(paypal.remainingDebt + recurringBurden);
  if (kpis.income > 0 && commitments / kpis.income > 0.35) {
    insights.push({
      id: "commitments-high",
      kind: "cashflow",
      severity: "leak",
      title: "Impegni alti vs entrate",
      detail: `Rate PayPal residue ${formatEur(paypal.remainingDebt)} + ricorrenti ${formatEur(recurringBurden)} = ${formatEur(commitments)}.`,
      impactEur: commitments,
      action: "Evita nuovi Paga in 3 finché non chiudi un piano.",
    });
    penalty += 14;
  } else if (paypal.remainingDebt > 100) {
    insights.push({
      id: "paypal-debt",
      kind: "cashflow",
      severity: "warn",
      title: "Rate PayPal ancora aperte",
      detail: `Debito stimato ${formatEur(paypal.remainingDebt)} su piani Paga in 3.`,
      impactEur: paypal.remainingDebt,
      action: "Apri tab PayPal per lo stato rate.",
    });
    penalty += 5;
  }

  if (kpis.income > 0 && savingsRate < 5) {
    insights.push({
      id: "savings-low",
      kind: "cashflow",
      severity: "leak",
      title: "Savings rate molto basso",
      detail: `Risparmi ~${savingsRate}% delle entrate (netto ${formatEur(kpis.net)}).`,
      action: "Taglia 1–2 ricorrenti o riduci la categoria più cara del mese.",
    });
    penalty += 16;
  } else if (kpis.income > 0 && savingsRate < 15) {
    insights.push({
      id: "savings-mid",
      kind: "cashflow",
      severity: "warn",
      title: "Margine di risparmio stretto",
      detail: `Savings rate ${savingsRate}%. Un imprevisto può mettere in rosso il mese.`,
      action: "Obiettivo soft: avvicinarsi al 20%.",
    });
    penalty += 8;
  } else if (kpis.income > 0 && savingsRate >= 20) {
    insights.push({
      id: "savings-ok",
      kind: "cashflow",
      severity: "info",
      title: "Buon ritmo di risparmio",
      detail: `Savings rate ${savingsRate}% — tieni d’occhio gli impegni PayPal.`,
    });
  }

  const months = monthlySeries(cash);
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
    penalty += 9;
  }

  if (cash.length < 15) {
    insights.push({
      id: "thin-data",
      kind: "cashflow",
      severity: "info",
      title: "Pochi movimenti per un consiglio fine",
      detail: "Importa più mesi di CSV per spike e ricorrenti più affidabili.",
    });
  }

  // Deduplicate / cap
  const ranked = insights
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 10);

  const score = Math.max(0, Math.min(100, 100 - penalty));
  return {
    score,
    label: scoreLabel(score),
    insights: ranked,
    summary: {
      income: kpis.income,
      expense: kpis.expense,
      net: kpis.net,
      savingsRate,
    },
  };
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
