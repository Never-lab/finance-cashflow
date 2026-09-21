/**
 * Tab Abbonamenti: merchant ricorrenti rilevati dai CSV, stima €/mese, stato utente
 * (potrei tagliare / cancellato) e cambio categoria bulk su tutti i movimenti del merchant.
 */
import { useMemo } from "react";
import type { RecurringMark, Transaction } from "@shared/types";
import { CATEGORIES } from "@shared/lib/categorize";
import { findRecurring, isSubscriptionLike } from "@shared/lib/recurring";
import { formatEurDisplay } from "../lib/privacyAmounts";

type Props = {
  transactions: Transaction[];
  categoryOverrides: Record<string, string>;
  marks: Record<string, RecurringMark>;
  onMark: (key: string, mark: RecurringMark) => void;
  onCategoryChange: (transactionIds: string[], category: string) => void;
  onUpload: () => void;
};

export function Recurring({
  transactions,
  categoryOverrides,
  marks,
  onMark,
  onCategoryChange,
  onUpload,
}: Props) {
  const items = useMemo(
    () =>
      [...findRecurring(transactions)]
        .filter(isSubscriptionLike)
        .sort((a, b) => b.monthlyEstimate - a.monthlyEstimate),
    [transactions],
  );
  const active = items.filter((i) => marks[i.key] !== "cancelled");
  /** Impegno mensile «reale» esclusi cancellati e voci segnate come tagliabili. */
  const burden = active
    .filter((i) => marks[i.key] !== "could_cancel")
    .reduce((s, i) => s + i.monthlyEstimate, 0);
  const couldSave = active
    .filter((i) => marks[i.key] === "could_cancel")
    .reduce((s, i) => s + i.monthlyEstimate, 0);

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
        <h2>Nessun ricorrente trovato</h2>
        <p className="muted">
          Servono almeno ~2 mesi di uscite simili (stesso merchant). Importa più
          storico o aspetta il prossimo mese.
        </p>
      </div>
    );
  }

  return (
    <div className="recurring">
      <div className="stat-row recurring-kpis">
        <div className="stat-card">
          <span className="stat-label">Stima ricorrenti / mese</span>
          <span className="stat-value">{formatEurDisplay(burden)}</span>
          <span className="stat-hint">
            Abbonamenti attivi, esclusi “cancellato” e “potrei tagliare”
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Potresti tagliare</span>
          <span className="stat-value neg">{formatEurDisplay(couldSave)}</span>
          <span className="stat-hint">Somma voci segnate “potrei tagliare”</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Voci trovate</span>
          <span className="stat-value">{String(items.length)}</span>
          <span className="stat-hint">Merchant con ≥2 mesi di uscite simili</span>
        </div>
      </div>
      <p className="muted kpi-note">
        Solo abbonamenti e servizi cancellabili. Cambia categoria per spostare una voce fuori da
        questa lista (es. Ristoranti, Shopping) — si applica a tutti i movimenti del merchant.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Descrizione</th>
              <th>Categoria</th>
              <th className="num" title="Media importi negli ultimi mesi rilevati">
                €/mese
              </th>
              <th>Frequenza</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const mark = marks[i.key] ?? "";
              const hasManualCategory = i.transactionIds.some((id) => categoryOverrides[id]);
              return (
                <tr
                  key={i.key}
                  className={
                    mark === "cancelled"
                      ? "row-cancelled"
                      : mark === "could_cancel"
                        ? "row-could"
                        : undefined
                  }
                >
                  <td>
                    <div>{i.label}</div>
                    <div className="muted tiny">
                      {i.count} mov. · ultimo {i.lastDate}
                    </div>
                  </td>
                  <td>
                    <select
                      value={i.category}
                      onChange={(e) => onCategoryChange(i.transactionIds, e.target.value)}
                    >
                      {!CATEGORIES.includes(i.category as (typeof CATEGORIES)[number]) && (
                        <option value={i.category}>{i.category}</option>
                      )}
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {!hasManualCategory && <span className="tag auto">auto</span>}
                  </td>
                  <td className="num neg">{formatEurDisplay(i.monthlyEstimate)}</td>
                  <td>
                    {i.months.length} mesi
                    {i.months.length >= 2 && (
                      <span className="muted tiny"> · ~mensile</span>
                    )}
                  </td>
                  <td>
                    <select
                      value={mark}
                      onChange={(e) =>
                        onMark(i.key, e.target.value as RecurringMark)
                      }
                    >
                      <option value="">—</option>
                      <option value="could_cancel">Potrei tagliare</option>
                      <option value="cancelled">Cancellato</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
