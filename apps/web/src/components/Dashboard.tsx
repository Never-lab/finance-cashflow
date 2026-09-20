/**
 * Tab Dashboard: KPI di consumo (entrate/uscite/margine), liquidità conti da CSV,
 * grafici Sankey, categorie, analisi espandibile (cumulato, barre mensili, heatmap).
 * Il periodo (mese / 3 mesi / tutto) è controllato dall'App.
 */
import { useMemo } from "react";
import type { Period, Transaction } from "@shared/types";
import {
  categoryBreakdownPct,
  cashflowSankey,
  computeKpis,
  cumulativeSeries,
  filterByPeriod,
  formatEur,
  monthlySeries,
  spendingHeatmap,
} from "@shared/lib/stats";
import { forConsumption } from "@shared/lib/consumptionView";
import type { LiquidityView } from "@shared/lib/liquidity";
import {
  CashflowCurve,
  CashflowSankeyChart,
  CategoryBars,
  IncomeExpenseBars,
  SpendingHeatmap,
} from "./charts/CashflowCharts";

type Props = {
  transactions: Transaction[];
  liquidity: LiquidityView | null;
  period: Period;
  onPeriod: (p: Period) => void;
  onUpload: () => void;
};

export function Dashboard({ transactions, liquidity, period, onPeriod, onUpload }: Props) {
  const periodAll = useMemo(() => filterByPeriod(transactions, period), [transactions, period]);
  /** Esclude giroconti interni: base per KPI e grafici di consumo. */
  const filtered = useMemo(() => forConsumption(periodAll), [periodAll]);
  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  /** Margine % arrotondato a 0,1% (netto / entrate). */
  const savingsRate = kpis.income > 0 ? Math.round((kpis.net / kpis.income) * 1000) / 10 : 0;
  const monthly = useMemo(() => monthlySeries(filtered), [filtered]);
  const cats = useMemo(() => categoryBreakdownPct(filtered, 6), [filtered]);
  const curve = useMemo(() => cumulativeSeries(filtered), [filtered]);
  const heat = useMemo(() => spendingHeatmap(filtered, 5), [filtered]);
  const sankey = useMemo(() => cashflowSankey(filtered, 7), [filtered]);
  /** Numero di movimenti esclusi (interni) rispetto al filtro periodo grezzo. */
  const hiddenFromCharts = useMemo(
    () => periodAll.length - filtered.length,
    [periodAll, filtered],
  );

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
          hint="Stipendio e altre entrate reali (no giroconti Revolut)"
        />
        <Kpi
          label="Uscite"
          value={formatEur(kpis.expense)}
          tone="neg"
          hint="Solo consumo e addebiti (no trasferimenti tra conti)"
        />
        <Kpi
          label="Margine"
          value={`${savingsRate.toFixed(0)}%`}
          tone={savingsRate >= 15 ? "pos" : "neg"}
          hint={`Netto ${formatEur(kpis.net)} · non è il saldo sui conti`}
        />
        <Kpi
          label="Netto periodo"
          value={formatEur(kpis.net)}
          tone={kpis.net >= 0 ? "pos" : "neg"}
          hint="Entrate − uscite consumo nel periodo"
        />
      </div>
      {hiddenFromCharts > 0 && (
        <p className="muted kpi-note">
          Esclusi {hiddenFromCharts} giroconti / trasferimenti interni da KPI e grafici. Rate non
          ancora addebitate (es. mutuo in arrivo) non compaiono finché non sono nel CSV.
        </p>
      )}
      {hiddenFromCharts === 0 && (
        <p className="muted kpi-note">
          Margine % = quanto resta dopo il consumo tracciato — non è la liquidità sui conti
          Mediolanum + Revolut.
        </p>
      )}

      <LiquidityPanel liquidity={liquidity} onUpload={onUpload} />

      <div className="charts-hero">
        <section className="panel chart-panel hero-panel">
          <h3>Flusso di cassa (Sankey)</h3>
          <p className="muted tiny chart-sub">
            Entrate reali → categorie di spesa + margine periodo. Giroconti Mediolanum↔Revolut
            esclusi.
          </p>
          {sankey ? (
            <CashflowSankeyChart data={sankey} />
          ) : (
            <p className="muted">Servono entrate o uscite nel periodo.</p>
          )}
        </section>

        <section className="panel chart-panel hero-panel">
          <h3>Uscite per categoria</h3>
          <p className="muted tiny chart-sub">Top categorie di consumo nel periodo.</p>
          <CategoryBars data={cats} />
        </section>
      </div>

      <details className="analisi-details">
        <summary className="analisi-summary">Analisi</summary>
        <div className="analisi-body">
          <div className="charts">
            <section className="panel chart-panel">
              <h3>Cash flow cumulato</h3>
              <p className="muted tiny chart-sub">
                Saldo cumulato del consumo netto (senza trasferimenti tra conti).
              </p>
              <CashflowCurve data={curve} />
            </section>
            <section className="panel chart-panel">
              <h3>Entrate vs uscite</h3>
              <IncomeExpenseBars data={monthly} />
            </section>
          </div>
          <section className="panel chart-panel">
            <h3>Heatmap spesa</h3>
            <p className="muted tiny chart-sub">Top 5 categorie per mese — intensità colore.</p>
            <SpendingHeatmap data={heat} />
          </section>
        </div>
      </details>
    </div>
  );
}

/** Sezione saldi Mediolanum/Revolut estratti dagli export CSV (distinta dai KPI flusso). */
function LiquidityPanel({
  liquidity,
  onUpload,
}: {
  liquidity: LiquidityView | null;
  onUpload: () => void;
}) {
  if (!liquidity?.totalEur && !liquidity?.mediolanum && !liquidity?.revolut) {
    return (
      <section className="stat-section liquidity-section" id="liquidita-conti">
        <h3 className="stat-section-title">Liquidità conti</h3>
        <p className="muted liquidity-note">
          Importa gli export CSV Mediolanum e Revolut per vedere saldi reali e pocket Revolut. I KPI
          sopra restano flussi di consumo, non liquidità.
        </p>
        <button type="button" className="btn" onClick={onUpload}>
          Carica CSV
        </button>
      </section>
    );
  }

  const med = liquidity.mediolanum;
  const rev = liquidity.revolut;
  /** Attuale effettivo al netto di importi in sospeso sul CSV Revolut. */
  const attuale = liquidity.revolutAttualeEffective ?? rev?.attuale ?? null;
  const pockets = liquidity.pockets;

  return (
    <section className="stat-section liquidity-section" id="liquidita-conti">
      <h3 className="stat-section-title">Liquidità conti</h3>
      <div className="stat-row liquidity-row">
        <div className="stat-card kpi">
          <span className="stat-label">Totale EUR</span>
          <span className="stat-value pos">
            {liquidity.totalEur != null ? formatEur(liquidity.totalEur) : "—"}
          </span>
          <span className="stat-hint">Mediolanum + Revolut (Attuale, pocket, deposito)</span>
        </div>
        {med && (
          <div className="stat-card">
            <span className="stat-label">Mediolanum</span>
            <span className="stat-value">{formatEur(med.available)}</span>
            <span className="stat-hint">
              Disponibile · contabile {formatEur(med.ledger)} · export {med.asOf}
            </span>
          </div>
        )}
        {attuale != null && (
          <div className="stat-card">
            <span className="stat-label">Revolut Attuale</span>
            <span className="stat-value">{formatEur(attuale)}</span>
            <span className="stat-hint">
              {rev && rev.pendingAttuale > 0
                ? `Al netto di ${formatEur(rev.pendingAttuale)} in sospeso · CSV ${rev.asOf}`
                : `Conto principale · CSV ${rev?.asOf ?? ""}`}
            </span>
          </div>
        )}
        {rev && (
          <div className="stat-card">
            <span className="stat-label">Revolut pocket + deposito</span>
            <span className="stat-value">{formatEur(rev.risparmi + rev.deposito)}</span>
            <span className="stat-hint">
              Risparmi {formatEur(rev.risparmi)} · Deposito {formatEur(rev.deposito)}
            </span>
          </div>
        )}
      </div>
      {pockets && rev && (
        <div className="stat-row liquidity-pockets">
          <div className="stat-card compact">
            <span className="stat-label">Pocket Viaggio</span>
            <span className="stat-value">{formatEur(pockets.viaggio)}</span>
            <span className="stat-hint">Stima da movimenti · Risparmi</span>
          </div>
          <div className="stat-card compact">
            <span className="stat-label">Pocket Manutenzione Auto</span>
            <span className="stat-value">{formatEur(pockets.manutenzioneAuto)}</span>
            <span className="stat-hint">Stima da movimenti · Risparmi</span>
          </div>
        </div>
      )}
      {liquidity.note && <p className="muted liquidity-note">{liquidity.note}</p>}
    </section>
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
