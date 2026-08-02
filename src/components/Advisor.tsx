import { useMemo } from "react";
import type { RecurringMark, Transaction } from "../types";
import { analyzeFinances, type Insight } from "../lib/advisor";
import { formatEur } from "../lib/stats";

type Props = {
  transactions: Transaction[];
  recurringMarks: Record<string, RecurringMark>;
  onGoAbbonamenti: () => void;
  onGoPaypal: () => void;
  onGoMovimenti: () => void;
  onUpload: () => void;
};

export function Advisor({
  transactions,
  recurringMarks,
  onGoAbbonamenti,
  onGoPaypal,
  onGoMovimenti,
  onUpload,
}: Props) {
  const report = useMemo(
    () => analyzeFinances(transactions, { recurringMarks }),
    [transactions, recurringMarks],
  );

  if (transactions.length === 0) {
    return (
      <div className="empty">
        <h2>Nessun dato da analizzare</h2>
        <p className="muted">Carica i CSV banca: il consigliere lavora solo in locale.</p>
        <button type="button" className="btn primary" onClick={onUpload}>
          Carica CSV
        </button>
      </div>
    );
  }

  return (
    <div className="advisor">
      <div className="stat-row advisor-hero">
        <div className={`stat-card score-card score-${scoreTone(report.score)}`}>
          <span className="stat-label">Salute cash flow</span>
          <span className="stat-value">{report.score}</span>
          <span className="stat-hint">{report.label}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Savings rate</span>
          <span className={`stat-value ${report.summary.savingsRate >= 15 ? "pos" : "neg"}`}>
            {report.summary.savingsRate.toFixed(0)}%
          </span>
          <span className="stat-hint">Netto {formatEur(report.summary.net)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Insight</span>
          <span className="stat-value">{report.insights.length}</span>
          <span className="stat-hint">Regole locali · no cloud</span>
        </div>
      </div>

      <p className="muted kpi-note">
        Analisi automatica su ricorrenti, anomalie e impegni. Non è consulenza
        finanziaria — sono segnali dai tuoi movimenti.
      </p>

      {report.insights.length === 0 ? (
        <div className="empty soft">
          <h2>Nessun leak evidente</h2>
          <p className="muted">Con i dati attuali non emergono critiche forti.</p>
        </div>
      ) : (
        <div className="insight-list">
          {report.insights.map((ins) => (
            <InsightCard
              key={ins.id}
              insight={ins}
              onGoAbbonamenti={onGoAbbonamenti}
              onGoPaypal={onGoPaypal}
              onGoMovimenti={onGoMovimenti}
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
}: {
  insight: Insight;
  onGoAbbonamenti: () => void;
  onGoPaypal: () => void;
  onGoMovimenti: () => void;
}) {
  return (
    <article className={`insight-card sev-${insight.severity}`}>
      <div className="insight-top">
        <span className={`insight-badge sev-${insight.severity}`}>
          {insight.severity === "leak" ? "Leak" : insight.severity === "warn" ? "Attenzione" : "Info"}
        </span>
        <span className="insight-kind">{kindLabel(insight.kind)}</span>
      </div>
      <h3>{insight.title}</h3>
      <p>{insight.detail}</p>
      {insight.impactEur != null && (
        <p className="insight-impact">Impatto stimato: {formatEur(insight.impactEur)}</p>
      )}
      {insight.action && <p className="insight-action">{insight.action}</p>}
      <div className="insight-actions">
        {insight.kind === "recurring" && (
          <button type="button" className="btn" onClick={onGoAbbonamenti}>
            Abbonamenti
          </button>
        )}
        {(insight.id.includes("paypal") || insight.id.includes("commitment")) && (
          <button type="button" className="btn" onClick={onGoPaypal}>
            PayPal
          </button>
        )}
        {(insight.kind === "anomaly" || insight.id.includes("uncategorized")) && (
          <button type="button" className="btn" onClick={onGoMovimenti}>
            Movimenti
          </button>
        )}
      </div>
    </article>
  );
}

function kindLabel(kind: Insight["kind"]): string {
  if (kind === "recurring") return "Ricorrenti";
  if (kind === "anomaly") return "Anomalie";
  return "Cash flow";
}
