import { useMemo } from "react";
import type { RecurringMark, Transaction } from "../types";
import { findRecurring } from "../lib/recurring";
import { formatEur } from "../lib/stats";

type Props = {
  transactions: Transaction[];
  marks: Record<string, RecurringMark>;
  onMark: (key: string, mark: RecurringMark) => void;
  onUpload: () => void;
};

export function Recurring({ transactions, marks, onMark, onUpload }: Props) {
  const items = useMemo(() => findRecurring(transactions), [transactions]);
  const active = items.filter((i) => marks[i.key] !== "cancelled");
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
          <span className="stat-value">{formatEur(burden)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Potresti tagliare</span>
          <span className="stat-value neg">{formatEur(couldSave)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Voci trovate</span>
          <span className="stat-value">{String(items.length)}</span>
        </div>
      </div>
      <p className="muted kpi-note">
        Rilevati da uscite ripetute (no trasferimenti interni). Segna “potrei
        tagliare” o “cancellato” — resta salvato in locale.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Descrizione</th>
              <th>Categoria</th>
              <th className="num">Media</th>
              <th>Mesi</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const mark = marks[i.key] ?? "";
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
                  <td>{i.category}</td>
                  <td className="num neg">{formatEur(i.monthlyEstimate)}</td>
                  <td>{i.months.length}</td>
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
