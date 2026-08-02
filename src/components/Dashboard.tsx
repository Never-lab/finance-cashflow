import { useMemo } from "react";
import type { Period, RecurringMark, Transaction } from "../types";
import {
  categoryBreakdownPct,
  cashflowSankey,
  computeKpis,
  cumulativeSeries,
  filterByPeriod,
  formatEur,
  monthlySeries,
  spendingHeatmap,
} from "../lib/stats";
import { forCashflow } from "../lib/internal";
import { buildPaypalSummary } from "../lib/paypal";
import { findRecurring } from "../lib/recurring";
import {
  CashflowCurve,
  CashflowSankeyChart,
  CategoryBars,
  IncomeExpenseBars,
  SpendingHeatmap,
} from "./charts/CashflowCharts";

type Props = {
  transactions: Transaction[];
  period: Period;
  recurringMarks: Record<string, RecurringMark>;
  onPeriod: (p: Period) => void;
  onUpload: () => void;
  onGoPaypal: () => void;
  onGoAbbonamenti: () => void;
};

export function Dashboard({
  transactions,
  period,
  recurringMarks,
  onPeriod,
  onUpload,
  onGoPaypal,
  onGoAbbonamenti,
}: Props) {
  const filtered = useMemo(() => {
    const byPeriod = filterByPeriod(transactions, period);
    return forCashflow(byPeriod);
  }, [transactions, period]);
  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const monthly = useMemo(() => monthlySeries(filtered), [filtered]);
  const cats = useMemo(() => categoryBreakdownPct(filtered, 6), [filtered]);
  const curve = useMemo(() => cumulativeSeries(filtered), [filtered]);
  const heat = useMemo(() => spendingHeatmap(filtered, 5), [filtered]);
  const sankey = useMemo(() => cashflowSankey(filtered, 7), [filtered]);
  const hiddenInternal = useMemo(() => {
    return filterByPeriod(transactions, period).length - filtered.length;
  }, [transactions, period, filtered]);

  const impegni = useMemo(() => {
    const paypal = buildPaypalSummary(transactions);
    const recurringMonthly = findRecurring(transactions)
      .filter((r) => recurringMarks[r.key] !== "cancelled")
      .reduce((s, r) => s + r.monthlyEstimate, 0);
    return {
      paypalDebt: paypal.remainingDebt,
      recurringMonthly,
      planCount: paypal.plans.filter((p) => p.status === "active").length,
    };
  }, [transactions, recurringMarks]);

  if (transactions.length === 0) {
    return (
      <div className="empty">
        <h2>Nessun movimento</h2>
        <p>Carica un CSV Mediolanum o Revolut Pocket per vedere il cash flow.</p>
        <button type="button" className="btn primary" onClick={onUpload}>
          Carica CSV
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="toolbar">
        <div className="period">
          {(
            [
              ["month", "Questo mese"],
              ["3m", "Ultimi 3 mesi"],
              ["all", "Tutto"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={period === k ? "chip active" : "chip"}
              onClick={() => onPeriod(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="btn primary" onClick={onUpload}>
          Carica CSV
        </button>
      </div>

      <div className="stat-row kpi-row">
        <Kpi label="Entrate" value={formatEur(kpis.income)} tone="pos" />
        <Kpi label="Uscite" value={formatEur(kpis.expense)} tone="neg" />
        <Kpi label="Netto" value={formatEur(kpis.net)} tone={kpis.net >= 0 ? "pos" : "neg"} />
        <Kpi label="Movimenti" value={String(kpis.count)} />
      </div>
      {hiddenInternal > 0 && (
        <p className="muted kpi-note">
          KPI senza trasferimenti interni ({hiddenInternal} esclusi).
        </p>
      )}

      <section className="stat-section">
        <h3 className="stat-section-title">Impegni</h3>
        <div className="stat-row impegni-row">
          <button type="button" className="stat-card interactive" onClick={onGoPaypal}>
            <span className="stat-label">Debito rate PayPal</span>
            <span className={`stat-value ${impegni.paypalDebt > 0 ? "neg" : ""}`}>
              {formatEur(impegni.paypalDebt)}
            </span>
            <span className="stat-hint">
              {impegni.planCount > 0
                ? `${impegni.planCount} piani attivi`
                : "Apri PayPal"}
            </span>
          </button>
          <button type="button" className="stat-card interactive" onClick={onGoAbbonamenti}>
            <span className="stat-label">Ricorrenti / mese</span>
            <span className="stat-value neg">{formatEur(impegni.recurringMonthly)}</span>
            <span className="stat-hint">Esclusi i cancellati</span>
          </button>
          <div className="stat-card">
            <span className="stat-label">Totale impegnato</span>
            <span className="stat-value neg">
              {formatEur(impegni.paypalDebt + impegni.recurringMonthly)}
            </span>
            <span className="stat-hint">Rate + abbonamenti</span>
          </div>
        </div>
      </section>

      <section className="panel chart-panel hero-panel">
        <h3>Flusso di cassa (Sankey)</h3>
        <p className="muted tiny chart-sub">
          Come su Getquin: da dove entra il denaro e dove finisce (categorie + risparmio).
        </p>
        {sankey ? (
          <CashflowSankeyChart data={sankey} />
        ) : (
          <p className="muted">Servono entrate o uscite nel periodo.</p>
        )}
      </section>

      <section className="panel chart-panel hero-panel">
        <h3>Cash flow cumulato</h3>
        <p className="muted tiny chart-sub">
          Come la curva patrimonio su Getquin, ma sul flusso del periodo selezionato.
        </p>
        <CashflowCurve data={curve} />
      </section>

      <div className="charts">
        <section className="panel chart-panel">
          <h3>Entrate vs uscite</h3>
          <IncomeExpenseBars data={monthly} />
        </section>

        <section className="panel chart-panel">
          <h3>Uscite per categoria</h3>
          <CategoryBars data={cats} />
        </section>
      </div>

      <section className="panel chart-panel">
        <h3>Heatmap spesa</h3>
        <p className="muted tiny chart-sub">Intensità per mese e categoria (top 5).</p>
        <SpendingHeatmap data={heat} />
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className={`stat-card kpi ${tone ?? ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
