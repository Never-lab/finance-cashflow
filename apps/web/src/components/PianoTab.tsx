/**
 * Tab Piano: checklist freschezza import, obiettivi Vault Revolut, piano liberazione debiti,
 * buffer Mediolanum consigliato, risparmio emergenza e riepilogo impegni (PayPal, mutui, abbonamenti).
 * Le card interattive navigano verso tab dedicati.
 */
import { useEffect, useMemo, useState } from "react";
import type { RecurringMark, Transaction } from "@shared/types";
import { filterByPeriod } from "@shared/lib/stats";
import { formatEurDisplay } from "../lib/privacyAmounts";
import type { LiquidityView } from "@shared/lib/liquidity";
import { sumEmergencyFundOutflows } from "@shared/lib/knownAccounts";
import { buildPaypalSummary } from "@shared/lib/paypal";
import { buildLoanSummary, type LoanTarget } from "@shared/lib/loans";
import { mergeLoanTargets } from "@shared/lib/knownLoans";
import { buildLiberationPlan, LIBERATION_DEFAULTS } from "@shared/lib/liberationPlan";
import { buildMediolanumBuffer, MEDIOLANUM_BUFFER_OVERSHOOT } from "@shared/lib/mediolanumBuffer";
import { findRecurring, isSubscriptionLike } from "@shared/lib/recurring";
import {
  IMPORT_FRESHNESS_MAX_AGE_DAYS,
  type ImportFreshnessRow,
} from "@shared/lib/importFreshness";
import {
  monthImportChecklist,
  type MonthChecklistRow,
  type PayslipChecklistRow,
} from "@shared/lib/monthChecklist";
import { api } from "../api";
import {
  buildVaultGoals,
  type VaultBalancesOverride,
  type VaultGoal,
  type VaultId,
} from "@shared/lib/vaultGoals";

type Props = {
  transactions: Transaction[];
  liquidity: LiquidityView | null;
  recurringMarks: Record<string, RecurringMark>;
  loanTargets: Record<string, LoanTarget>;
  vaultBalances: VaultBalancesOverride;
  onVaultBalance: (id: VaultId, amount: number | null) => void;
  onUpload: () => void;
  onGoPayslips: () => void;
  onGoPaypal: () => void;
  onGoAbbonamenti: () => void;
  onGoMutui: () => void;
  onGoInvestimenti?: () => void;
  /** Bump after import/recompute so cedolino checklist refreshes. */
  refreshKey?: number;
};

const SOURCE_LABEL: Record<ImportFreshnessRow["source"], string> = {
  mediolanum: "Mediolanum",
  revolut: "Revolut",
};

export function PianoTab({
  transactions,
  liquidity,
  recurringMarks,
  loanTargets,
  vaultBalances,
  onVaultBalance,
  onUpload,
  onGoPayslips,
  onGoPaypal,
  onGoAbbonamenti,
  onGoMutui,
  onGoInvestimenti,
  refreshKey = 0,
}: Props) {
  const [payslipPeriods, setPayslipPeriods] = useState<
    { periodYear: number; periodMonth: number }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    api
      .getPayslips()
      .then((s) => {
        if (cancelled) return;
        setPayslipPeriods(
          s.payslips.map((p) => ({ periodYear: p.periodYear, periodMonth: p.periodMonth })),
        );
      })
      .catch(() => {
        if (!cancelled) setPayslipPeriods([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);
  const monthTx = useMemo(() => filterByPeriod(transactions, "month"), [transactions]);

  const savings = useMemo(
    () => ({ emergencyOut: sumEmergencyFundOutflows(monthTx) }),
    [monthTx],
  );

  /** Aggregati mensili/residui per deep-link PayPal, mutui, abbonamenti. */
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

  const checklist = useMemo(
    () => monthImportChecklist(liquidity, payslipPeriods),
    [liquidity, payslipPeriods],
  );

  const vaultGoals = useMemo(
    () => buildVaultGoals(transactions, vaultBalances),
    [transactions, vaultBalances],
  );

  return (
    <div className="piano-tab">
      <ImportChecklistPanel
        rows={checklist}
        onUpload={onUpload}
        onGoPayslips={onGoPayslips}
      />

      <VaultGoalsPanel goals={vaultGoals} onSave={onVaultBalance} />

      <LiberationPlanPanel
        plan={liberation}
        onGoPaypal={onGoPaypal}
        onGoMutui={onGoMutui}
      />

      {mediolanumBuffer && liquidity?.mediolanum && (
        <section className="stat-section" id="buffer-mediolanum-section">
          <MediolanumBufferPanel buffer={mediolanumBuffer} />
        </section>
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
              {formatEurDisplay(savings.emergencyOut)}
            </span>
            <span className="stat-hint">
              Versato questo mese · IBAN …14212 · escluso da uscite KPI
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
              {formatEurDisplay(impegni.paypalDebt)}
            </span>
            <span className="stat-hint">
              {impegni.planCount > 0
                ? `${impegni.planCount} piani attivi · stimato da CSV banca`
                : "Rate mancanti × importo rata — stimato da CSV banca"}
            </span>
          </button>
          <button type="button" className="stat-card interactive" onClick={onGoMutui}>
            <span className="stat-label">Mutui e prestiti</span>
            <span
              className={`stat-value ${impegni.loanDebt > 0 ? "neg" : impegni.loanMonthly > 0 ? "neg" : ""}`}
            >
              {impegni.loanDebt > 0
                ? formatEurDisplay(impegni.loanDebt)
                : impegni.loanMonthly > 0
                  ? formatEurDisplay(impegni.loanMonthly)
                  : "—"}
            </span>
            <span className="stat-hint">
              {impegni.loanCount > 0
                ? impegni.loanDebt > 0
                  ? `${impegni.loanCount} finanziament${impegni.loanCount === 1 ? "o" : "i"} · ${formatEurDisplay(impegni.loanDebt)} residuo`
                  : `${formatEurDisplay(impegni.loanMonthly)}/m · Selfycredit e altri`
                : "Nessun finanziamento rilevato nei CSV"}
            </span>
          </button>
          <button type="button" className="stat-card interactive" onClick={onGoAbbonamenti}>
            <span className="stat-label">Abbonamenti / mese</span>
            <span className="stat-value neg">{formatEurDisplay(impegni.recurringMonthly)}</span>
            <span className="stat-hint">Solo abbonamenti (no mutuo, assicurazioni, bollette)</span>
          </button>
          <div className="stat-card">
            <span className="stat-label">Totale impegnato</span>
            <span className="stat-value neg">
              {formatEurDisplay(
                // Se c'è residuo mutuo usa quello; altrimenti somma la rata mensile stimata.
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
    </div>
  );
}

function VaultGoalsPanel({
  goals,
  onSave,
}: {
  goals: VaultGoal[];
  onSave: (id: VaultId, amount: number | null) => void;
}) {
  const p0 = goals.find((g) => g.isP0);
  /** Testo priorità P0 (Casa vs Auto) in base alla deadline vault attiva. */
  const waterfallLine =
    p0?.id === "casa"
      ? "P0: Vault Casa (da Dic 2026) · Auto in mantenimento"
      : "P0: Vault Auto (fino Nov 2026) → poi Casa";

  return (
    <section className="stat-section vault-section" id="obiettivi-vault">
      <h3 className="stat-section-title">Obiettivi risparmio</h3>
      <p className="muted vault-waterfall">{waterfallLine}</p>
      <div className="liberation-grid vault-grid">
        {goals.map((goal) => (
          <VaultGoalCard key={goal.id} goal={goal} onSave={onSave} />
        ))}
      </div>
    </section>
  );
}

function VaultGoalCard({
  goal,
  onSave,
}: {
  goal: VaultGoal;
  onSave: (id: VaultId, amount: number | null) => void;
}) {
  const [draft, setDraft] = useState(String(goal.current));
  useEffect(() => {
    setDraft(String(goal.current));
  }, [goal.current, goal.source]);

  const hintParts: string[] = [];
  if (goal.deadline) hintParts.push(`deadline ${goal.deadline}`);
  if (goal.monthlyHint != null) hintParts.push(`+${formatEurDisplay(goal.monthlyHint)}/m`);
  hintParts.push(goal.source === "override" ? "manuale" : "da CSV");

  return (
    <div className={`liberation-card savings${goal.isP0 ? " vault-p0" : ""}`}>
      <div className="liberation-head">
        <span className="liberation-label">
          {goal.label}
          {goal.isP0 ? <span className="vault-p0-badge">P0</span> : null}
        </span>
        <span className="liberation-pct savings">{goal.pct.toFixed(0)}%</span>
      </div>
      <div className="liberation-progress" aria-hidden>
        <div className="liberation-progress-fill savings" style={{ width: `${goal.pct}%` }} />
      </div>
      <div className="liberation-meta">
        <span>{formatEurDisplay(goal.current)} accantonati</span>
        <span className="liberation-remaining">mancano {formatEurDisplay(goal.remaining)}</span>
      </div>
      <span className="stat-hint">
        Target {formatEurDisplay(goal.target)}
        {hintParts.length ? ` · ${hintParts.join(" · ")}` : ""}
      </span>
      <div className="vault-override">
        <label className="vault-override-label">
          Saldo €
          <input
            type="number"
            min={0}
            step={0.01}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const n = Number(draft.replace(",", "."));
            if (!Number.isFinite(n) || n < 0) return;
            onSave(goal.id, n);
          }}
        >
          Salva
        </button>
        {goal.source === "override" && (
          <button type="button" className="btn" onClick={() => onSave(goal.id, null)}>
            Usa stima
          </button>
        )}
      </div>
    </div>
  );
}

function ImportChecklistPanel({
  rows,
  onUpload,
  onGoPayslips,
}: {
  rows: MonthChecklistRow[];
  onUpload: () => void;
  onGoPayslips: () => void;
}) {
  const banksStale = rows.some((r) => r.kind === "bank" && !r.ok);
  const payslipStale = rows.some((r) => r.kind === "payslip" && !r.ok);
  const allOk = !banksStale && !payslipStale;

  return (
    <section className="stat-section import-checklist" id="checklist-import">
      <h3 className="stat-section-title">Checklist import</h3>
      <p className="muted">
        CSV fresco (saldo ≤ {IMPORT_FRESHNESS_MAX_AGE_DAYS}g) + cedolino del mese scorso.
      </p>
      <div className="stat-row import-checklist-row">
        {rows.map((row) =>
          row.kind === "bank" ? (
            <div
              key={row.source}
              className={`stat-card compact import-check ${row.ok ? "ok" : "stale"}`}
            >
              <span className="stat-label">{SOURCE_LABEL[row.source]}</span>
              <span className={`stat-value ${row.ok ? "pos" : "neg"}`}>
                {row.ok ? "Aggiornato" : row.missing ? "Manca" : "Export vecchio"}
              </span>
              <span className="stat-hint">
                {row.missing
                  ? "Nessun snapshot saldi — carica CSV"
                  : row.asOf
                    ? `Export ${row.asOf}${row.ageDays != null ? ` · ${row.ageDays}g` : ""}`
                    : "—"}
              </span>
            </div>
          ) : (
            <PayslipCheckCard key="payslip" row={row} />
          ),
        )}
      </div>
      {!allOk && (
        <div className="settings-actions">
          {banksStale && (
            <button type="button" className="btn primary" onClick={onUpload}>
              Carica CSV
            </button>
          )}
          {payslipStale && (
            <button type="button" className="btn primary" onClick={onGoPayslips}>
              Vai a Buste paga
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function PayslipCheckCard({ row }: { row: PayslipChecklistRow }) {
  return (
    <div className={`stat-card compact import-check ${row.ok ? "ok" : "stale"}`}>
      <span className="stat-label">Cedolino {row.periodLabel}</span>
      <span className={`stat-value ${row.ok ? "pos" : "neg"}`}>
        {row.ok ? "Presente" : "Manca"}
      </span>
      <span className="stat-hint">
        {row.ok ? "Mese scorso in archivio" : "Carica PDF busta paga del mese scorso"}
      </span>
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
                    ? `${formatEurDisplay(goal.current)} restituiti`
                    : `${formatEurDisplay(goal.current)} accantonati`}
                </span>
                <span className="liberation-remaining">
                  {isDebt
                    ? `${formatEurDisplay(goal.remaining)} residuo`
                    : `mancano ${formatEurDisplay(goal.remaining)}`}
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
          Liberabile su Attuale (al netto di {formatEurDisplay(LIBERATION_DEFAULTS.attualeFloat)} di float):{" "}
          <strong>{formatEurDisplay(plan.liberabileEstimate)}</strong>
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
        {formatEurDisplay(MEDIOLANUM_BUFFER_OVERSHOOT)} di margine quando chiudi un piano.
      </p>
      <div className="stat-row mediolanum-buffer-kpis">
        <div className={`stat-card compact buffer-${buffer.status}`}>
          <span className="stat-label">Target mese tipo</span>
          <span className="stat-value">{formatEurDisplay(buffer.recommendedNormal)}</span>
          <span className="stat-hint">
            Base {formatEurDisplay(buffer.monthlyBase)} + {formatEurDisplay(MEDIOLANUM_BUFFER_OVERSHOOT)} margine
          </span>
        </div>
        <div className="stat-card compact">
          <span className="stat-label">Target mese PayPal alto</span>
          <span className="stat-value">{formatEurDisplay(buffer.recommendedPeak)}</span>
          <span className="stat-hint">
            {buffer.peakMonth ? `Picco ${buffer.peakMonth}` : "Ultimi 3 mesi CSV"}
          </span>
        </div>
        {buffer.currentAvailable != null && (
          <div className={`stat-card compact buffer-${buffer.status}`}>
            <span className="stat-label">Disponibile ora</span>
            <span className={`stat-value ${buffer.status === "ok" ? "pos" : "neg"}`}>
              {formatEurDisplay(buffer.currentAvailable)}
            </span>
            <span className="stat-hint">{statusLabel}</span>
          </div>
        )}
        {buffer.gap != null && buffer.gap > 0 && (
          <div className="stat-card compact">
            <span className="stat-label">Mancano al target</span>
            <span className="stat-value neg">{formatEurDisplay(buffer.gap)}</span>
            <span className="stat-hint">Prima degli addebiti fine mese</span>
          </div>
        )}
      </div>
      <ul className="mediolanum-buffer-lines">
        {buffer.lines.map((line) => (
          <li key={line.id}>
            <span>{line.label}</span>
            <span>{formatEurDisplay(line.monthly)}/m</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
