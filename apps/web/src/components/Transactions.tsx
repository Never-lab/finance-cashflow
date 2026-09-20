/**
 * Tab Movimenti: tabella filtrabile (mese, banca, testo, nascondi interni) con override
 * categoria e flag «interno» per ogni riga; riepilogo entrate/uscite sui filtri attivi.
 */
import { useMemo, useState } from "react";
import type { BankSource, Transaction } from "@shared/types";
import { CATEGORIES } from "@shared/lib/categorize";
import { formatEur } from "@shared/lib/stats";

type Props = {
  transactions: Transaction[];
  categoryOverrides: Record<string, string>;
  onCategoryChange: (id: string, category: string) => void;
  onInternalChange: (id: string, internal: boolean) => void;
  onUpload: () => void;
};

export function Transactions({
  transactions,
  categoryOverrides,
  onCategoryChange,
  onInternalChange,
  onUpload,
}: Props) {
  const [month, setMonth] = useState("all");
  const [source, setSource] = useState<"all" | BankSource>("all");
  const [q, setQ] = useState("");
  const [hideInternal, setHideInternal] = useState(true);

  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date.slice(0, 7)));
    return [...set].sort().reverse();
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (hideInternal && t.internal) return false;
      if (month !== "all" && !t.date.startsWith(month)) return false;
      if (source !== "all" && t.source !== source) return false;
      if (q && !t.description.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [transactions, month, source, q, hideInternal]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.amount >= 0) income += t.amount;
      else expense += t.amount;
    }
    return { count: filtered.length, income, expense, net: income + expense };
  }, [filtered]);

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

  return (
    <div className="transactions">
      <div className="toolbar wrap sticky">
        <label>
          Mese{" "}
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="all">Tutti</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fonte{" "}
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as "all" | BankSource)}
          >
            <option value="all">Tutte</option>
            <option value="mediolanum">Mediolanum</option>
            <option value="revolut">Revolut</option>
          </select>
        </label>
        <button
          type="button"
          className={hideInternal ? "chip active" : "chip"}
          onClick={() => setHideInternal((v) => !v)}
        >
          Nascondi interni
        </button>
        <input
          className="search"
          placeholder="Cerca descrizione…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="btn primary" onClick={onUpload}>
          Carica CSV
        </button>
      </div>

      <p className="txn-summary">
        <strong>{summary.count}</strong> movimenti · Uscite{" "}
        <strong className="neg">{formatEur(summary.expense)}</strong> · Entrate{" "}
        <strong className="pos">{formatEur(summary.income)}</strong> · Netto{" "}
        <strong className={summary.net >= 0 ? "pos" : "neg"}>{formatEur(summary.net)}</strong>
        {hideInternal && <span> · interni esclusi</span>}
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrizione</th>
              <th>Fonte</th>
              <th>Categoria</th>
              <th>Interno</th>
              <th className="num" title="+ entrata, − uscita">
                Importo
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className={t.internal ? "row-internal" : undefined}>
                <td>{t.date}</td>
                <td title={t.description}>
                  {t.description}
                  {t.internal && <span className="tag internal">interno</span>}
                </td>
                <td>
                  <span className={`tag ${t.source}`}>{t.source}</span>
                </td>
                <td>
                  <select
                    value={t.category}
                    onChange={(e) => onCategoryChange(t.id, e.target.value)}
                  >
                    {!CATEGORIES.includes(t.category as (typeof CATEGORIES)[number]) && (
                      <option value={t.category}>{t.category}</option>
                    )}
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {!categoryOverrides[t.id] && <span className="tag auto">auto</span>}
                </td>
                <td>
                  <label className="internal-toggle" title="Escluso dai KPI cash flow">
                    <input
                      type="checkbox"
                      checked={Boolean(t.internal)}
                      onChange={(e) => onInternalChange(t.id, e.target.checked)}
                    />
                    Interno
                  </label>
                </td>
                <td className={`num ${t.amount >= 0 ? "pos" : "neg"}`}>
                  {formatEur(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="muted">Nessun risultato con questi filtri.</p>}
      </div>
    </div>
  );
}
