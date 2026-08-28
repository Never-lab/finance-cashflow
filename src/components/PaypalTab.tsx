import { useMemo } from "react";
import type { Transaction } from "../types";
import { buildPaypalSummary } from "../lib/paypal";
import { formatEur } from "../lib/stats";

type Props = {
  transactions: Transaction[];
  onUpload: () => void;
};

export function PaypalTab({ transactions, onUpload }: Props) {
  const summary = useMemo(() => buildPaypalSummary(transactions), [transactions]);

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

  if (
    summary.plans.length === 0 &&
    summary.otherOut.length === 0 &&
    summary.income.length === 0
  ) {
    return (
      <div className="empty">
        <h2>Nessun movimento PayPal</h2>
        <p className="muted">
          Quando in banca compaiono addebiti tipo «Paga in 3» o SDD PayPal, li
          vedrai qui raggruppati. Nessuna API: solo dai CSV già caricati.
        </p>
      </div>
    );
  }

  return (
    <div className="paypal-tab">
      <div className="stat-row recurring-kpis">
        <div className="stat-card">
          <span className="stat-label">Uscite PayPal (totale)</span>
          <span className="stat-value neg">{formatEur(summary.totalOut)}</span>
          <span className="stat-hint">Tutti gli addebiti PayPal nel CSV, piani inclusi</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Debito rate stimato</span>
          <span className="stat-value neg">{formatEur(summary.remainingDebt)}</span>
          <span className="stat-hint">
            Somma residui piani “In corso” — non saldo PayPal reale
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Accrediti PayPal</span>
          <span className="stat-value pos">{formatEur(summary.totalIn)}</span>
          <span className="stat-hint">Entrate da movimenti PayPal in banca</span>
        </div>
      </div>
      <p className="muted kpi-note">Stima da CSV banca. Non è l’app PayPal.</p>

      {summary.plans.length > 0 && (
        <section className="panel paypal-section">
          <h3>Piani e rate</h3>
          <div className="table-wrap flat">
            <table>
              <thead>
                <tr>
                  <th>Piano</th>
                  <th>Stato</th>
                  <th className="num">Rata</th>
                  <th className="num">Pagate</th>
                  <th className="num" title="Rate mancanti × importo rata">
                    Residuo
                  </th>
                  <th>Ultima</th>
                </tr>
              </thead>
              <tbody>
                {summary.plans.map((p) => (
                  <tr key={p.key}>
                    <td>
                      <div>{p.label}</div>
                      <div className="muted tiny">
                        {p.dates.map((d) => d.slice(5)).join(" · ")}
                      </div>
                      {p.status === "active" && (
                        <div className="muted tiny">Prossima rata ~ fine mese</div>
                      )}
                    </td>
                    <td>
                      <span className={`tag status-${p.status}`}>
                        {p.status === "active"
                          ? "In corso"
                          : p.status === "likely_done"
                            ? "Prob. chiuso"
                            : "Ricorrente"}
                      </span>
                    </td>
                    <td className="num neg">{formatEur(p.installmentAmount)}</td>
                    <td className="num">
                      {p.expectedCount
                        ? `${p.paidCount}/${p.expectedCount}`
                        : String(p.paidCount)}
                    </td>
                    <td className="num neg">
                      {p.remainingEstimate != null
                        ? formatEur(p.remainingEstimate)
                        : "—"}
                    </td>
                    <td>{p.lastDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {summary.otherOut.length > 0 && (
        <section className="panel paypal-section">
          <h3>Altri addebiti PayPal</h3>
          <div className="table-wrap flat">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrizione</th>
                  <th className="num">Importo</th>
                </tr>
              </thead>
              <tbody>
                {summary.otherOut.map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td title={t.description}>{t.description}</td>
                    <td className="num neg">{formatEur(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {summary.income.length > 0 && (
        <section className="panel paypal-section">
          <h3>Accrediti</h3>
          <div className="table-wrap flat">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrizione</th>
                  <th className="num">Importo</th>
                </tr>
              </thead>
              <tbody>
                {summary.income.map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td title={t.description}>{t.description}</td>
                    <td className="num pos">{formatEur(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
