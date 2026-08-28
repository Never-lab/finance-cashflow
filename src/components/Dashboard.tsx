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
import { sumEmergencyFundOutflows } from "../lib/knownAccounts";
import { buildPaypalSummary } from "../lib/paypal";
import { buildLoanSummary, type LoanTarget } from "../lib/loans";
import { mergeLoanTargets } from "../lib/knownLoans";
import { findRecurring, isSubscriptionLike } from "../lib/recurring";
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
  loanTargets: Record<string, LoanTarget>;
  onPeriod: (p: Period) => void;
  onUpload: () => void;
  onGoPaypal: () => void;
  onGoAbbonamenti: () => void;
  onGoMutui: () => void;
  onGoInvestimenti?: () => void;
};

export function Dashboard({
  transactions,
  period,
  recurringMarks,
  loanTargets,
  onPeriod,
  onUpload,
  onGoPaypal,
  onGoAbbonamenti,
  onGoMutui,
  onGoInvestimenti,
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

  const periodAll = useMemo(() => filterByPeriod(transactions, period), [transactions, period]);

  const savings = useMemo(() => {
    const emergencyOut = sumEmergencyFundOutflows(periodAll);
    return { emergencyOut };
  }, [periodAll]);

  const impegni = useMemo(() => {
    const paypal = buildPaypalSummary(transactions);
    const loans = buildLoanSummary(transactions, mergeLoanTargets(loanTargets));
    const recurringMonthly = findRecurring(transactions)
      .filter(isSubscriptionLike)
      .filter((r) => recurringMarks[r.key] !== "cancelled")
      .reduce((s, r) => s + r.monthlyEstimate, 0);
    return {
      paypalDebt: paypal.remainingDebt,
      loanDebt: loans.remainingDebt,
      loanMonthly: loans.monthlyBurden,
      loanCount: loans.plans.length,
      recurringMonthly,
      planCount: paypal.plans.filter((p) => p.status === "active").length,
    };
  }, [transactions, recurringMarks, loanTargets]);

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
        <Kpi
          label="Entrate"
          value={formatEur(kpis.income)}
          tone="pos"
          hint="Somma entrate nel periodo selezionato"
        />
        <Kpi
          label="Uscite"
          value={formatEur(kpis.expense)}
          tone="neg"
          hint="Somma uscite (no trasferimenti interni)"
        />
        <Kpi
          label="Netto"
          value={formatEur(kpis.net)}
          tone={kpis.net >= 0 ? "pos" : "neg"}
          hint="Entrate − uscite"
        />
        <Kpi label="Movimenti" value={String(kpis.count)} hint="Transazioni nel periodo" />
      </div>
      {hiddenInternal > 0 && (
        <p className="muted kpi-note">
          Esclusi {hiddenInternal} trasferimenti interni dai KPI
          {savings.emergencyOut > 0
            ? ` (inclusi ${formatEur(savings.emergencyOut)} verso fondo emergenza deposito)`
            : ""}
          .
        </p>
      )}

      <section className="stat-section">
        <h3 className="stat-section-title">Risparmio programmato</h3>
        <div className="stat-row impegni-row">
          <div
            className={`stat-card${onGoInvestimenti ? " interactive" : ""}`}
            role={onGoInvestimenti ? "button" : undefined}
            tabIndex={onGoInvestimenti ? 0 : undefined}
            onClick={onGoInvestimenti}
            onKeyDown={
              onGoInvestimenti
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") onGoInvestimenti();
                  }
                : undefined
            }
          >
            <span className="stat-label">Fondo emergenza (deposito)</span>
            <span className={`stat-value ${savings.emergencyOut > 0 ? "pos" : ""}`}>
              {formatEur(savings.emergencyOut)}
            </span>
            <span className="stat-hint">
              Versato nel periodo · IBAN …14212 · escluso da uscite KPI
            </span>
          </div>
        </div>
      </section>

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
                ? `${impegni.planCount} piani attivi · stimato da CSV banca`
                : "Rate mancanti × importo rata — stimato da CSV banca"}
            </span>
          </button>
          <button type="button" className="stat-card interactive" onClick={onGoMutui}>
            <span className="stat-label">Mutui e prestiti</span>
            <span className={`stat-value ${impegni.loanDebt > 0 ? "neg" : impegni.loanMonthly > 0 ? "neg" : ""}`}>
              {impegni.loanDebt > 0
                ? formatEur(impegni.loanDebt)
                : impegni.loanMonthly > 0
                  ? formatEur(impegni.loanMonthly)
                  : "—"}
            </span>
            <span className="stat-hint">
              {impegni.loanCount > 0
                ? impegni.loanDebt > 0
                  ? `${impegni.loanCount} finanziament${impegni.loanCount === 1 ? "o" : "i"} · ${formatEur(impegni.loanDebt)} residuo`
                  : `${formatEur(impegni.loanMonthly)}/m · Selfycredit e altri`
                : "Nessun finanziamento rilevato nei CSV"}
            </span>
          </button>
          <button type="button" className="stat-card interactive" onClick={onGoAbbonamenti}>
            <span className="stat-label">Abbonamenti / mese</span>
            <span className="stat-value neg">{formatEur(impegni.recurringMonthly)}</span>
            <span className="stat-hint">
              Solo abbonamenti (no mutuo, assicurazioni, bollette)
            </span>
          </button>
          <div className="stat-card">
            <span className="stat-label">Totale impegnato</span>
            <span className="stat-value neg">
              {formatEur(
                impegni.paypalDebt +
                  impegni.loanDebt +
                  impegni.recurringMonthly +
                  (impegni.loanDebt > 0 ? 0 : impegni.loanMonthly),
              )}
            </span>
            <span className="stat-hint">
              PayPal residuo + mutuo + abbonamenti — non cash disponibile
            </span>
          </div>
        </div>
      </section>

      <div className="charts-hero">
        <section className="panel chart-panel hero-panel">
          <h3>Flusso di cassa (Sankey)</h3>
          <p className="muted tiny chart-sub">
            Da dove entrano i soldi e dove escono (categorie e risparmio).
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
            Andamento del netto giorno per giorno nel periodo.
          </p>
          <CashflowCurve data={curve} />
        </section>
      </div>

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
        <p className="muted tiny chart-sub">Top 5 categorie per mese — intensità colore.</p>
        <SpendingHeatmap data={heat} />
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  hint?: string;
}) {
  return (
    <div className={`stat-card kpi ${tone ?? ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}
