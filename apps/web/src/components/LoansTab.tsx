/**
 * Tab Mutui: contratti da CSV Mediolanum, rate mensili, residuo (banca o stima),
 * editing numero totale rate con persistenza target su API.
 */
import { useMemo, useState } from "react";
import type { LoanTarget } from "@shared/lib/loans";
import { buildLoanSummary } from "@shared/lib/loans";
import { mergeLoanTargets } from "@shared/lib/knownLoans";
import type { Transaction } from "@shared/types";
import { formatEur } from "@shared/lib/stats";

type Props = {
  transactions: Transaction[];
  loanTargets: Record<string, LoanTarget>;
  onSaveTarget: (key: string, target: LoanTarget | null) => void;
  onUpload: () => void;
};

export function LoansTab({ transactions, loanTargets, onSaveTarget, onUpload }: Props) {
  const targets = useMemo(() => mergeLoanTargets(loanTargets), [loanTargets]);
  const summary = useMemo(
    () => buildLoanSummary(transactions, targets),
    [transactions, targets],
  );

  if (transactions.length === 0) {
    return (
      <div className="empty">
        <h2>Nessun movimento</h2>
        <button type="button" className="btn primary" onClick={onUpload}>
          Carica CSV
        </button>
      </div>
    );
  }

  if (summary.plans.length === 0) {
    return (
      <div className="empty">
        <h2>Nessun mutuo o prestito</h2>
        <p className="muted">
          Quando in banca compaiono addebiti tipo «PAG. MUTUO/FIN. VARI» o categorizzati
          come Mutuo, li vedrai qui raggruppati per contratto.
        </p>
      </div>
    );
  }

  return (
    <div className="loans-tab">
      <div className="stat-row recurring-kpis">
        <div className="stat-card">
          <span className="stat-label">Rate mensili</span>
          <span className="stat-value neg">{formatEur(summary.monthlyBurden)}</span>
          <span className="stat-hint">Somma rate attive rilevate da CSV</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Debito residuo</span>
          <span className={`stat-value ${summary.remainingDebt > 0 ? "neg" : ""}`}>
            {summary.remainingDebt > 0 ? formatEur(summary.remainingDebt) : "—"}
          </span>
          <span className="stat-hint">
            {summary.plans.some((p) => p.remainingSource === "bank")
              ? "Da sintesi banca Mediolanum (include interessi)"
              : summary.remainingDebt > 0
                ? "Stima: rate mancanti × importo rata"
                : "Contratto senza dati residuo"}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Restituito</span>
          <span className="stat-value">
            {summary.plans.some((p) => p.totalRepaidBank != null)
              ? formatEur(
                  summary.plans.reduce((s, p) => s + (p.totalRepaidBank ?? p.totalPaid), 0),
                )
              : formatEur(summary.totalPaid)}
          </span>
          <span className="stat-hint">
            {summary.plans.some((p) => p.totalRepaidBank != null)
              ? "Totale restituito banca · CSV addebiti in tabella sotto"
              : "Somma addebiti mutuo/prestito importati"}
          </span>
        </div>
      </div>
      <p className="muted kpi-note">
        Selfycredit e altri finanziamenti da CSV + sintesi contratto. Aggiorna debito residuo da
        area clienti quando cambia (Dati → oppure modifica in tabella).
      </p>

      <section className="panel paypal-section">
        <h3>Contratti</h3>
        <div className="table-wrap flat">
          <table>
            <thead>
              <tr>
                <th>Contratto</th>
                <th className="num">Rata</th>
                <th className="num">Pagate</th>
                <th className="num">Tot. rate</th>
                <th className="num" title="Debito residuo banca o stima rate">
                  Residuo
                </th>
                <th>Prossima</th>
                <th>Ultima</th>
              </tr>
            </thead>
            <tbody>
              {summary.plans.map((p) => (
                <LoanRow
                  key={p.key}
                  plan={p}
                  target={targets[p.key]}
                  onSave={(target) => onSaveTarget(p.key, target)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function LoanRow({
  plan,
  target,
  onSave,
}: {
  plan: ReturnType<typeof buildLoanSummary>["plans"][number];
  target?: LoanTarget;
  onSave: (target: LoanTarget | null) => void;
}) {
  const [totalStr, setTotalStr] = useState(() =>
    plan.totalInstallments != null ? String(plan.totalInstallments) : "",
  );

  /** Unisce dati CSV, sintesi banca e override utente per il PUT targets. */
  function mergedTarget(): LoanTarget {
    return {
      label: target?.label ?? plan.label,
      principalAmount: target?.principalAmount ?? plan.principalAmount ?? undefined,
      endDate: target?.endDate ?? plan.endDate ?? undefined,
      remainingDebt:
        target?.remainingDebt ??
        (plan.remainingSource === "bank" && plan.remainingEstimate != null
          ? plan.remainingEstimate
          : undefined),
      totalRepaid: target?.totalRepaid ?? plan.totalRepaidBank ?? undefined,
      nextPaymentDate: target?.nextPaymentDate ?? plan.nextPaymentDate ?? undefined,
      totalInstallments: target?.totalInstallments ?? plan.totalInstallments ?? undefined,
    };
  }

  function commitTotal() {
    const trimmed = totalStr.trim();
    const base = mergedTarget();
    if (trimmed === "") {
      const { totalInstallments: _drop, ...rest } = base;
      onSave(Object.keys(rest).length > 0 ? rest : null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) return;
    onSave({ ...base, totalInstallments: Math.round(n) });
  }

  return (
    <tr>
      <td>
        <div>{plan.label}</div>
        {plan.contractRef && (
          <div className="muted tiny">Contratto {plan.contractRef}</div>
        )}
        {(plan.principalAmount != null || plan.startDate || plan.endDate) && (
          <div className="muted tiny">
            {plan.principalAmount != null ? `Importo ${formatEur(plan.principalAmount)}` : ""}
            {plan.startDate ? `${plan.principalAmount != null ? " · " : ""}inizio ${plan.startDate.slice(5)}/${plan.startDate.slice(0, 4)}` : ""}
            {plan.endDate ? ` · fine ${plan.endDate.slice(5)}/${plan.endDate.slice(0, 4)}` : ""}
          </div>
        )}
        {plan.indicativeTan != null && (
          <div className="muted tiny" title="Non da estratto contratto — solo riferimento">
            TAN indicativo ~{plan.indicativeTan.toFixed(1)}% (stima)
          </div>
        )}
        <div className="muted tiny">
          {plan.paidCount} pagate
          {plan.remainingInstallments != null ? ` · ${plan.remainingInstallments} da pagare` : ""}
          {plan.totalPaid > 0 ? ` · CSV ${formatEur(plan.totalPaid)}` : ""}
        </div>
      </td>
      <td className="num">{formatEur(plan.installmentAmount)}</td>
      <td className="num">{plan.paidCount}</td>
      <td className="num">
        <input
          type="number"
          className="input-compact"
          min={1}
          placeholder="es. 36"
          value={totalStr}
          onChange={(e) => setTotalStr(e.target.value)}
          onBlur={commitTotal}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          title="Numero totale di rate previste dal contratto"
        />
      </td>
      <td className="num">
        {plan.remainingEstimate != null ? formatEur(plan.remainingEstimate) : "—"}
        {plan.remainingSource === "bank" && (
          <div className="muted tiny">banca</div>
        )}
        {plan.remainingSource === "estimate" && plan.remainingInstallments != null && (
          <div className="muted tiny">{plan.remainingInstallments} rate × rata</div>
        )}
      </td>
      <td>
        {plan.nextPaymentDate ? (
          <>
            {plan.nextPaymentDate}
            <div className="muted tiny">{formatEur(plan.installmentAmount)}</div>
          </>
        ) : (
          "—"
        )}
      </td>
      <td>
        {plan.lastDate}
        <div className="muted tiny">{formatEur(plan.installmentAmount)}</div>
      </td>
    </tr>
  );
}
