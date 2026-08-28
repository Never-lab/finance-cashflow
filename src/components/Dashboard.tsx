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
import { forConsumption } from "../lib/consumptionView";
import type { LiquidityView } from "../lib/liquidity";
import { sumEmergencyFundOutflows } from "../lib/knownAccounts";
import { buildPaypalSummary } from "../lib/paypal";
import { buildLoanSummary, type LoanTarget } from "../lib/loans";
import { mergeLoanTargets } from "../lib/knownLoans";
import { buildLiberationPlan, LIBERATION_DEFAULTS } from "../lib/liberationPlan";
import { buildMediolanumBuffer, MEDIOLANUM_BUFFER_OVERSHOOT } from "../lib/mediolanumBuffer";
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
  liquidity: LiquidityView | null;
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
  liquidity,
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
  const periodAll = useMemo(() => filterByPeriod(transactions, period), [transactions, period]);

  const filtered = useMemo(() => forConsumption(periodAll), [periodAll]);
  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const savingsRate = kpis.income > 0 ? Math.round((kpis.net / kpis.income) * 1000) / 10 : 0;
  const monthly = useMemo(() => monthlySeries(filtered), [filtered]);
  const cats = useMemo(() => categoryBreakdownPct(filtered, 6), [filtered]);
  const curve = useMemo(() => cumulativeSeries(filtered), [filtered]);
  const heat = useMemo(() => spendingHeatmap(filtered, 5), [filtered]);
  const sankey = useMemo(() => cashflowSankey(filtered, 7), [filtered]);
  const hiddenFromCharts = useMemo(
    () => periodAll.length - filtered.length,
    [periodAll, filtered],
  );

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

  const liberation = useMemo(
    () => buildLiberationPlan(transactions, loanTargets, liquidity),
    [transactions, loanTargets, liquidity],
  );

  const mediolanumBuffer = useMemo(
    () => buildMediolanumBuffer(transactions, liquidity),
    [transactions, liquidity],
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
          Esclusi {hiddenFromCharts} giroconti / trasferimenti interni da KPI e grafici
          {savings.emergencyOut > 0
            ? ` (inclusi ${formatEur(savings.emergencyOut)} verso fondo emergenza deposito)`
            : ""}
          . Rate non ancora addebitate (es. mutuo in arrivo) non compaiono finché non sono nel CSV.
        </p>
      )}
      {hiddenFromCharts === 0 && (
        <p className="muted kpi-note">
          Margine % = quanto resta dopo il consumo tracciato — non è la liquidità sui conti Mediolanum +
          Revolut.
        </p>
      )}

      <LiquidityPanel
        liquidity={liquidity}
        buffer={mediolanumBuffer}
        onUpload={onUpload}
      />

      <LiberationPlanPanel
        plan={liberation}
        onGoPaypal={onGoPaypal}
        onGoMutui={onGoMutui}
      />

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
            Entrate reali → categorie di spesa + margine periodo. Giroconti Mediolanum↔Revolut esclusi.
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
            Saldo cumulato del consumo netto (senza trasferimenti tra conti).
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

function LiberationPlanPanel({
  plan,
  onGoPaypal,
  onGoMutui,
}: {
  plan: ReturnType<typeof buildLiberationPlan>;
  onGoPaypal: () => void;
  onGoMutui: () => void;
}) {
  return (
    <section className="stat-section liberation-section" id="piano-liberazione">
      <h3 className="stat-section-title">Piano liberazione</h3>
      <p className="muted liberation-intro">
        PayPal prima, Selfycredit a colpi parziali, bucket Viaggio e Tech in parallelo. Le barre
        mostrano quanto hai già liberato (debiti) o accantonato (risparmi).
      </p>
      <div className="liberation-grid">
        {plan.goals.map((goal) => {
          const isDebt = goal.kind === "debt";
          const onClick =
            goal.id === "paypal" ? onGoPaypal : goal.id === "selfy" ? onGoMutui : undefined;
          return (
            <div
              key={goal.id}
              className={`liberation-card ${goal.kind}${onClick ? " interactive" : ""}`}
              role={onClick ? "button" : undefined}
              tabIndex={onClick ? 0 : undefined}
              onClick={onClick}
              onKeyDown={
                onClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") onClick();
                    }
                  : undefined
              }
            >
              <div className="liberation-head">
                <span className="liberation-label">{goal.label}</span>
                <span className={`liberation-pct ${isDebt ? "debt" : "savings"}`}>
                  {goal.pct.toFixed(0)}%
                </span>
              </div>
              <div className="liberation-progress" aria-hidden>
                <div
                  className={`liberation-progress-fill ${goal.kind}`}
                  style={{ width: `${goal.pct}%` }}
                />
              </div>
              <div className="liberation-meta">
                <span>
                  {isDebt
                    ? `${formatEur(goal.current)} restituiti`
                    : `${formatEur(goal.current)} accantonati`}
                </span>
                <span className="liberation-remaining">
                  {isDebt
                    ? `${formatEur(goal.remaining)} residuo`
                    : `mancano ${formatEur(goal.remaining)}`}
                </span>
              </div>
              <span className="stat-hint">{goal.hint}</span>
              {goal.phase && <span className="liberation-phase">{goal.phase}</span>}
            </div>
          );
        })}
      </div>
      {plan.liberabileEstimate != null && (
        <p className="muted liberation-note">
          Liberabile su Attuale (al netto di {formatEur(LIBERATION_DEFAULTS.attualeFloat)} di float):{" "}
          <strong>{formatEur(plan.liberabileEstimate)}</strong>
          {plan.paypalUnder600 ? " · PayPal sotto soglia fase Selfy" : ""}
        </p>
      )}

      <div className="roadmap-memo" aria-label="Memo piano pocket">
        <p className="roadmap-memo-title">Memo retta via · 4 pocket</p>
        <p className="roadmap-memo-pockets muted tiny">
          Auto 75 · Vacanze 75 · Tech 75 · Debiti 218 €/m · Emergenza Med +150 €/m
        </p>
        <ol className="roadmap-memo-list">
          <li>
            <time dateTime="2026-09">Set 2026</time>
            <span>Zona secca → stipendio 15 · buffer Med 950 €</span>
          </li>
          <li>
            <time dateTime="2026-12">Dic 2026</time>
            <span>PayPal chiuso · 13ª 50% emergenza / 40% Debiti</span>
          </li>
          <li>
            <time dateTime="2027-04">Apr 2027</time>
            <span>1° colpo Selfy −1.000 € (pocket Debiti ≥1.200)</span>
          </li>
          <li>
            <time dateTime="2027-08">Ago 2027</time>
            <span>2° colpo Selfy · focus Avvera + emergenza ~1.900 €</span>
          </li>
        </ol>
      </div>
    </section>
  );
}

function LiquidityPanel({
  liquidity,
  buffer,
  onUpload,
}: {
  liquidity: LiquidityView | null;
  buffer: ReturnType<typeof buildMediolanumBuffer>;
  onUpload: () => void;
}) {
  if (!liquidity?.totalEur && !liquidity?.mediolanum && !liquidity?.revolut) {
    return (
      <section className="stat-section liquidity-section" id="liquidita-conti">
        <h3 className="stat-section-title">Liquidità conti</h3>
        <p className="muted liquidity-note">
          Importa gli export CSV Mediolanum e Revolut per vedere saldi reali e pocket Revolut.
          I KPI sopra restano flussi di consumo, non liquidità.
        </p>
        <button type="button" className="btn" onClick={onUpload}>
          Carica CSV
        </button>
      </section>
    );
  }

  const med = liquidity.mediolanum;
  const rev = liquidity.revolut;
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

      {buffer && med && (
        <MediolanumBufferPanel buffer={buffer} />
      )}

      {liquidity.note && <p className="muted liquidity-note">{liquidity.note}</p>}
    </section>
  );
}

function MediolanumBufferPanel({
  buffer,
}: {
  buffer: NonNullable<ReturnType<typeof buildMediolanumBuffer>>;
}) {
  const statusLabel =
    buffer.status === "ok"
      ? "Sufficiente"
      : buffer.status === "low"
        ? "Sotto target"
        : buffer.status === "critical"
          ? "Troppo basso"
          : "—";

  return (
    <div className="mediolanum-buffer" id="buffer-mediolanum">
      <h4 className="mediolanum-buffer-title">Buffer Mediolanum consigliato</h4>
      <p className="muted mediolanum-buffer-intro">
        Quanto lasciare sul conto corrente per SDD, rate carta e bonifico emergenza. Include{" "}
        {formatEur(MEDIOLANUM_BUFFER_OVERSHOOT)} di margine quando chiudi un piano.
      </p>
      <div className="stat-row mediolanum-buffer-kpis">
        <div className={`stat-card compact buffer-${buffer.status}`}>
          <span className="stat-label">Target mese tipo</span>
          <span className="stat-value">{formatEur(buffer.recommendedNormal)}</span>
          <span className="stat-hint">
            Base {formatEur(buffer.monthlyBase)} + {formatEur(MEDIOLANUM_BUFFER_OVERSHOOT)} margine
          </span>
        </div>
        <div className="stat-card compact">
          <span className="stat-label">Target mese PayPal alto</span>
          <span className="stat-value">{formatEur(buffer.recommendedPeak)}</span>
          <span className="stat-hint">
            {buffer.peakMonth ? `Picco ${buffer.peakMonth}` : "Ultimi 3 mesi CSV"}
          </span>
        </div>
        {buffer.currentAvailable != null && (
          <div className={`stat-card compact buffer-${buffer.status}`}>
            <span className="stat-label">Disponibile ora</span>
            <span className={`stat-value ${buffer.status === "ok" ? "pos" : "neg"}`}>
              {formatEur(buffer.currentAvailable)}
            </span>
            <span className="stat-hint">{statusLabel}</span>
          </div>
        )}
        {buffer.gap != null && buffer.gap > 0 && (
          <div className="stat-card compact">
            <span className="stat-label">Mancano al target</span>
            <span className="stat-value neg">{formatEur(buffer.gap)}</span>
            <span className="stat-hint">Prima degli addebiti fine mese</span>
          </div>
        )}
      </div>
      <ul className="mediolanum-buffer-lines">
        {buffer.lines.map((line) => (
          <li key={line.id}>
            <span>{line.label}</span>
            <span>{formatEur(line.monthly)}/m</span>
          </li>
        ))}
      </ul>
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
