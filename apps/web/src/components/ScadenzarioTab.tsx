/**
 * Tab Scadenzario: prossime scadenze unificate (mutui, PayPal, abbonamenti, vault).
 */
import { useMemo } from "react";
import type { RecurringMark, Transaction } from "@shared/types";
import type { LoanTarget } from "@shared/lib/loans";
import type { PaypalTarget } from "@shared/lib/paypal";
import type { VaultBalancesOverride } from "@shared/lib/vaultGoals";
import {
  buildScadenzario,
  type ScadenzaItem,
  type ScadenzaKind,
} from "@shared/lib/scadenzario";
import { formatEurDisplay } from "../lib/privacyAmounts";
import type { AppTab } from "./AppShell";

const HORIZON_DAYS = 60;

type Props = {
  transactions: Transaction[];
  marks: Record<string, RecurringMark>;
  loanTargets: Record<string, LoanTarget>;
  paypalTargets: Record<string, PaypalTarget>;
  vaultBalances?: VaultBalancesOverride;
  onUpload: () => void;
  onGo: (tab: AppTab) => void;
};

function formatItDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function kindLabel(kind: ScadenzaKind): string {
  switch (kind) {
    case "loan":
      return "Mutuo";
    case "paypal":
      return "PayPal";
    case "subscription":
      return "Abbonamento";
    case "vault":
      return "Vault";
  }
}

export function ScadenzarioTab({
  transactions,
  marks,
  loanTargets,
  paypalTargets,
  vaultBalances,
  onUpload,
  onGo,
}: Props) {
  const { items, totalDue, monthBurden } = useMemo(
    () =>
      buildScadenzario({
        transactions,
        recurringMarks: marks,
        loanTargets,
        paypalTargets,
        vaultBalances,
        horizonDays: HORIZON_DAYS,
      }),
    [transactions, marks, loanTargets, paypalTargets, vaultBalances],
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

  if (items.length === 0) {
    return (
      <div className="empty">
        <h2>Nessuna scadenza nei prossimi {HORIZON_DAYS} giorni</h2>
        <p className="muted">
          Rate mutui/PayPal, abbonamenti e scadenze Vault compaiono qui quando hanno una data
          stimata nel periodo.
        </p>
      </div>
    );
  }

  return (
    <div className="scadenzario-tab">
      <div className="stat-row recurring-kpis">
        <div className="stat-card">
          <span className="stat-label">Totale prossimi {HORIZON_DAYS} giorni</span>
          <span className="stat-value neg">{formatEurDisplay(totalDue)}</span>
          <span className="stat-hint">Rate da pagare (vault escluso dai totali)</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Carico questo mese</span>
          <span className="stat-value neg">{formatEurDisplay(monthBurden)}</span>
          <span className="stat-hint">Solo scadenze del mese corrente</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Voci</span>
          <span className="stat-value">{String(items.length)}</span>
          <span className="stat-hint">Mutui · PayPal · abbonamenti · vault</span>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Voce</th>
              <th>Tipo</th>
              <th className="num">Importo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row: ScadenzaItem) => (
              <tr key={row.id}>
                <td>{formatItDate(row.dueDate)}</td>
                <td>{row.label}</td>
                <td>{kindLabel(row.kind)}</td>
                <td className="num neg">
                  {row.amount != null ? formatEurDisplay(row.amount) : "—"}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => onGo(row.sourceTab)}
                  >
                    Apri
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
