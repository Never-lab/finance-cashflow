/**
 * Tab PayPal: piani rate «Paga in 3» / Pay Monthly da addebiti banca, debito residuo sui piani
 * noti (Unieuro, Autodoc), altre stime CSV e movimenti non pianificati.
 */
import { useMemo } from "react";
import type { Transaction } from "@shared/types";
import { buildPaypalSummary } from "@shared/lib/paypal";
import { formatEur } from "@shared/lib/stats";

type Props = {
  transactions: Transaction[];
  onUpload: () => void;
};

function formatItDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function PaypalTab({ transactions, onUpload }: Props) {
  const summary = useMemo(() => buildPaypalSummary(transactions), [transactions]);
  /** Piani con merchant noto (entrano in KPI liberazione) vs stime generiche da CSV. */
  const knownPlans = summary.plans.filter((p) => p.merchantLabel);
  const otherPlans = summary.plans.filter((p) => !p.merchantLabel);

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
          <span className="stat-label">Rate attive (mese)</span>
          <span className="stat-value neg">{formatEur(summary.monthlyBurden)}</span>
          <span className="stat-hint">Solo Unieuro + Autodoc (allineati all’app)</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Debito rate stimato</span>
          <span className="stat-value neg">{formatEur(summary.remainingDebt)}</span>
          <span className="stat-hint">
            Residuo piani noti — senza stime generiche CSV
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Uscite PayPal (totale)</span>
          <span className="stat-value neg">{formatEur(summary.totalOut)}</span>
          <span className="stat-hint">Tutti gli addebiti PayPal nel CSV</span>
        </div>
      </div>
      <p className="muted kpi-note">
        Rate e debito KPI contano solo i piani noti (Unieuro + Autodoc). Altri «Paga in 3» da CSV
        banca restano sotto come stima incerto — non entrano nei consigli né nel piano liberazione.
      </p>

      {knownPlans.length > 0 && (
        <section className="panel paypal-section">
          <h3>Piani attivi</h3>
          <div className="table-wrap flat">
            <table>
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Piano</th>
                  <th>Stato</th>
                  <th className="num">Rata</th>
                  <th className="num">Pagate</th>
                  <th className="num">Residuo</th>
                  <th>Prossima</th>
                  <th>Ultima</th>
                </tr>
              </thead>
              <tbody>
                {knownPlans.map((p) => (
                  <tr key={p.key}>
                    <td>
                      <div>{p.merchantLabel}</div>
                      {p.startDate && (
                        <div className="muted tiny">Acquisto {formatItDate(p.startDate)}</div>
                      )}
                      {p.principalAmount != null && (
                        <div className="muted tiny">
                          Importo {formatEur(p.principalAmount)}
                          {p.totalAmount != null && p.totalAmount !== p.principalAmount
                            ? ` · totale ${formatEur(p.totalAmount)}`
                            : ""}
                          {p.indicativeTaeg != null ? ` · TAEG ${p.indicativeTaeg}%` : ""}
                        </div>
                      )}
                    </td>
                    <td>{p.kind === "pay_monthly" ? "Pay Monthly" : "Paga in 3"}</td>
                    <td>
                      <span className={`tag status-${p.status}`}>
                        {p.status === "active"
                          ? "In corso"
                          : p.status === "likely_done"
                            ? "Chiuso"
                            : "Ricorrente"}
                      </span>
                    </td>
                    <td className="num neg">{formatEur(p.installmentAmount)}</td>
                    <td className="num">
                      {p.expectedCount ? `${p.paidCount}/${p.expectedCount}` : String(p.paidCount)}
                    </td>
                    <td className="num neg">
                      {p.remainingEstimate != null ? formatEur(p.remainingEstimate) : "—"}
                    </td>
                    <td>{formatItDate(p.nextPaymentDate)}</td>
                    <td>{p.lastDate || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {otherPlans.length > 0 && (
        <section className="panel paypal-section">
          <h3>Altri piani (stima CSV)</h3>
          <div className="table-wrap flat">
            <table>
              <thead>
                <tr>
                  <th>Piano</th>
                  <th>Stato</th>
                  <th className="num">Rata</th>
                  <th className="num">Pagate</th>
                  <th className="num">Residuo</th>
                  <th>Ultima</th>
                </tr>
              </thead>
              <tbody>
                {otherPlans.map((p) => (
                  <tr key={p.key}>
                    <td>
                      <div>{p.label}</div>
                      <div className="muted tiny">
                        {p.dates.map((d) => d.slice(5)).join(" · ")}
                      </div>
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
                      {p.remainingEstimate != null ? formatEur(p.remainingEstimate) : "—"}
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
