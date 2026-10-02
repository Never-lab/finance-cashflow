/**
 * Tab Consigli: punteggio salute cash flow, insight rule-based locali (no LLM cloud),
 * filtri per tipo e link rapidi verso tab correlati; opzionale snapshot portafoglio da API.
 */
import { useEffect, useMemo, useState } from "react";
import type { Period, RecurringMark, Transaction } from "@shared/types";
import type { LoanTarget } from "@shared/lib/loans";
import type { PaypalTarget } from "@shared/lib/paypal";
import type { CategoryBudgets } from "@shared/lib/budget";
import { api, type PortfolioSummary } from "../api";
import {
  analyzeFinances,
  kindLabel,
  type Insight,
  type InsightKind,
} from "@shared/lib/advisor";
import { PERIOD_LABELS_SHORT } from "@shared/lib/periodLabels";
import { formatEurDisplay } from "../lib/privacyAmounts";

type Props = {
  transactions: Transaction[];
  recurringMarks: Record<string, RecurringMark>;
  loanTargets: Record<string, LoanTarget>;
  paypalTargets?: Record<string, PaypalTarget>;
  categoryBudgets?: CategoryBudgets;
  onGoAbbonamenti: () => void;
  onGoPaypal: () => void;
  onGoMovimenti: () => void;
  onGoMutui: () => void;
  onGoInvestimenti: () => void;
  onGoDashboard: () => void;
  onGoBudget?: () => void;
  onGoPiano?: () => void;
  onUpload: () => void;
};

const PERIOD_ORDER: Period[] = ["month", "30d", "3m", "all"];

const FILTER_KINDS: { id: "all" | InsightKind; label: string }[] = [
  { id: "all", label: "Tutti" },
  { id: "recurring", label: "Ricorrenti" },
  { id: "anomaly", label: "Anomalie" },
  { id: "cashflow", label: "Flusso" },
  { id: "patrimonio", label: "Patrimonio" },
];

export function Advisor({
  transactions,
  recurringMarks,
  loanTargets,
  paypalTargets = {},
  categoryBudgets = {},
  onGoAbbonamenti,
  onGoPaypal,
  onGoMovimenti,
  onGoMutui,
  onGoInvestimenti,
  onGoDashboard,
  onGoBudget,
  onGoPiano,
  onUpload,
}: Props) {
  const [period, setPeriod] = useState<Period>("3m");
  const [kindFilter, setKindFilter] = useState<"all" | InsightKind>("all");
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);

  useEffect(() => {
    void api.getPortfolioSummary().then(setPortfolio).catch(() => setPortfolio(null));
  }, []);

  /** Sottoinsieme portafoglio passato al motore insight (patrimonio). */
  const portfolioSnap = useMemo(
    () =>
      portfolio
        ? {
            totalContributed: portfolio.totalContributed,
            totalValue: portfolio.totalValue,
            pnl: portfolio.pnl,
          }
        : null,
    [portfolio],
  );

  const report = useMemo(
    () =>
      analyzeFinances(transactions, {
        recurringMarks,
        loanTargets,
        paypalTargets,
        categoryBudgets,
        period,
        portfolio: portfolioSnap,
      }),
    [transactions, recurringMarks, loanTargets, paypalTargets, categoryBudgets, period, portfolioSnap],
  );

  const visibleInsights = useMemo(
    () =>
      kindFilter === "all"
        ? report.insights
        : report.insights.filter((i) => i.kind === kindFilter),
    [report.insights, kindFilter],
  );

  if (transactions.length === 0) {
    return (
      <div className="empty">
        <h2>Nessun dato da analizzare</h2>
        <p className="muted">Carica i CSV banca: l&apos;analisi gira solo in locale.</p>
        <button type="button" className="btn primary" onClick={onUpload}>
          Carica CSV
        </button>
      </div>
    );
  }

  return (
    <div className="advisor">
      <div className="period">
        {PERIOD_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            className={period === k ? "chip active" : "chip"}
            aria-pressed={period === k}
            onClick={() => setPeriod(k)}
          >
            {PERIOD_LABELS_SHORT[k]}
          </button>
        ))}
      </div>

      <div className="stat-row advisor-hero">
        <div className={`stat-card score-card score-${scoreTone(report.score)}`}>
          <span className="stat-label">Punteggio regole locali</span>
          <span className="stat-value">{report.score}</span>
          <span className="stat-hint">
            {report.label}
            {report.scoreDelta != null && (
              <span className={`score-trend ${report.scoreDelta >= 0 ? "pos" : "neg"}`}>
                {" "}
                {report.scoreDelta >= 0 ? "▲" : "▼"} {Math.abs(report.scoreDelta)}
              </span>
            )}
            {onGoPiano && (
              <>
                {" · "}
                <button type="button" className="linkish" onClick={onGoPiano}>
                  Apri Piano liberazione
                </button>
              </>
            )}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Quota risparmiata</span>
          <span className={`stat-value ${report.summary.savingsRate >= 15 ? "pos" : "neg"}`}>
            {report.summary.savingsRate.toFixed(0)}%
          </span>
          <span className="stat-hint">Netto consumo {formatEurDisplay(report.summary.net)} · non saldo conti</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Impegni / mese</span>
          <span className="stat-value neg">{formatEurDisplay(report.impegni.monthlyBurden)}</span>
          <span className="stat-hint">
            {report.impegni.paypalDebt > 0
              ? `+ PayPal residuo ${formatEurDisplay(report.impegni.paypalDebt)}`
              : "Mutui + ricorrenti + PayPal"}
          </span>
          <span className="stat-hint muted">
            Rate/residui: storico completo, non filtrati dal periodo chip
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avvisi</span>
          <span className="stat-value">{report.insights.length}</span>
          <span className="stat-hint">Regole locali · no cloud</span>
        </div>
      </div>

      <p className="muted kpi-note">
        Analisi su consumo reale (giroconti Mediolanum↔Revolut esclusi). Risparmio % ≠ liquidità
        sui conti — rate future non ancora in CSV non sono incluse.
      </p>

      {report.topActions.length > 0 && (
        <section className="advisor-top-actions">
          <h3 className="stat-section-title">Azioni prioritarie</h3>
          <p className="muted tiny chart-sub">
            Ordinate per impatto stimato e gravità delle regole locali (non consulenza umana).
          </p>
          <div className="top-action-list">
            {report.topActions.map((ins, i) => (
              <div key={ins.id} className="top-action-item">
                <span className="top-action-num">{i + 1}</span>
                <div>
                  <strong>{ins.title}</strong>
                  {ins.action && <p className="muted">{ins.action}</p>}
                </div>
                <InsightLinks
                  insight={ins}
                  onGoAbbonamenti={onGoAbbonamenti}
                  onGoPaypal={onGoPaypal}
                  onGoMovimenti={onGoMovimenti}
                  onGoMutui={onGoMutui}
                  onGoInvestimenti={onGoInvestimenti}
                  onGoDashboard={onGoDashboard}
                  onGoBudget={onGoBudget}
                  compact
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="period advisor-filters">
        {FILTER_KINDS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={kindFilter === f.id ? "chip active" : "chip"}
            aria-pressed={kindFilter === f.id}
            onClick={() => setKindFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visibleInsights.length === 0 ? (
        <div className="empty soft">
          <h2>Nessuno spreco evidente</h2>
          <p className="muted">
            {kindFilter === "all"
              ? "Con i dati attuali non emergono critiche forti."
              : "Nessun insight in questa categoria per il periodo."}
          </p>
        </div>
      ) : (
        <div className="insight-list">
          {visibleInsights.map((ins) => (
            <InsightCard
              key={ins.id}
              insight={ins}
              onGoAbbonamenti={onGoAbbonamenti}
              onGoPaypal={onGoPaypal}
              onGoMovimenti={onGoMovimenti}
              onGoMutui={onGoMutui}
              onGoInvestimenti={onGoInvestimenti}
              onGoDashboard={onGoDashboard}
              onGoBudget={onGoBudget}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function scoreTone(score: number): string {
  if (score >= 80) return "good";
  if (score >= 60) return "mid";
  return "bad";
}

function InsightCard({
  insight,
  onGoAbbonamenti,
  onGoPaypal,
  onGoMovimenti,
  onGoMutui,
  onGoInvestimenti,
  onGoDashboard,
  onGoBudget,
}: {
  insight: Insight;
  onGoAbbonamenti: () => void;
  onGoPaypal: () => void;
  onGoMovimenti: () => void;
  onGoMutui: () => void;
  onGoInvestimenti: () => void;
  onGoDashboard: () => void;
  onGoBudget?: () => void;
}) {
  return (
    <article className={`insight-card sev-${insight.severity}`}>
      <div className="insight-top">
        <span className={`insight-badge sev-${insight.severity}`}>
          {insight.severity === "leak" ? "Spreco" : insight.severity === "warn" ? "Attenzione" : "Info"}
        </span>
        <span className="insight-kind">{kindLabel(insight.kind)}</span>
      </div>
      <h3>{insight.title}</h3>
      <p>{insight.detail}</p>
      {insight.impactEur != null && (
        <p className="insight-impact">Impatto stimato: {formatEurDisplay(insight.impactEur)}</p>
      )}
      {insight.action && <p className="insight-action">{insight.action}</p>}
      <InsightLinks
        insight={insight}
        onGoAbbonamenti={onGoAbbonamenti}
        onGoPaypal={onGoPaypal}
        onGoMovimenti={onGoMovimenti}
        onGoMutui={onGoMutui}
        onGoInvestimenti={onGoInvestimenti}
        onGoDashboard={onGoDashboard}
        onGoBudget={onGoBudget}
      />
    </article>
  );
}

/** Pulsanti contestuali in base a kind/id insight (navigazione tra tab). */
function InsightLinks({
  insight,
  onGoAbbonamenti,
  onGoPaypal,
  onGoMovimenti,
  onGoMutui,
  onGoInvestimenti,
  onGoDashboard,
  onGoBudget,
  compact = false,
}: {
  insight: Insight;
  onGoAbbonamenti: () => void;
  onGoPaypal: () => void;
  onGoMovimenti: () => void;
  onGoMutui: () => void;
  onGoInvestimenti: () => void;
  onGoDashboard: () => void;
  onGoBudget?: () => void;
  compact?: boolean;
}) {
  const cls = compact ? "btn sm" : "btn";
  return (
    <div className="insight-actions">
      {insight.kind === "recurring" && (
        <button type="button" className={cls} onClick={onGoAbbonamenti}>
          Abbonamenti
        </button>
      )}
      {(insight.id.includes("paypal") ||
        insight.id.includes("commitment") ||
        insight.id.includes("debt")) && (
        <button type="button" className={cls} onClick={onGoPaypal}>
          PayPal
        </button>
      )}
      {(insight.id.includes("loan") || insight.id.includes("mutui")) && (
        <button type="button" className={cls} onClick={onGoMutui}>
          Mutui
        </button>
      )}
      {insight.kind === "patrimonio" && (
        <button type="button" className={cls} onClick={onGoInvestimenti}>
          Investimenti
        </button>
      )}
      {(insight.kind === "anomaly" || insight.id.includes("uncategorized")) && (
        <button type="button" className={cls} onClick={onGoMovimenti}>
          Movimenti
        </button>
      )}
      {insight.id.startsWith("budget-") && onGoBudget && (
        <button type="button" className={cls} onClick={onGoBudget}>
          Budget
        </button>
      )}
      {(insight.kind === "cashflow" &&
        (insight.id.includes("savings") || insight.id.includes("red-months"))) && (
        <button type="button" className={cls} onClick={onGoDashboard}>
          Dashboard
        </button>
      )}
    </div>
  );
}
