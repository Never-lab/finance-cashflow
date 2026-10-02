/**
 * Tab Budget: confronto spesa mese corrente vs limiti per categoria, barre di avanzamento
 * e form per aggiungere/aggiornare/rimuovere budget (persistiti via API).
 */
import { useEffect, useMemo, useState } from "react";
import type { Transaction } from "@shared/types";
import { CATEGORIES } from "@shared/lib/categorize";
import {
  BUDGET_EXCLUDED_CATEGORIES,
  buildBudgetReport,
  type BudgetRow,
  type BudgetStatus,
  type CategoryBudgets,
} from "@shared/lib/budget";
import { formatEurDisplay } from "../lib/privacyAmounts";

type Props = {
  transactions: Transaction[];
  budgets: CategoryBudgets;
  onSave: (category: string, limit: number | null) => void;
  onUpload: () => void;
  onGoConsigli?: () => void;
};

const STATUS_LABEL: Record<BudgetStatus, string> = {
  ok: "Ok",
  warn: "80%+",
  over: "Oltre",
};

const MONTH_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

export function BudgetTab({ transactions, budgets, onSave, onUpload, onGoConsigli }: Props) {
  const report = useMemo(
    () => buildBudgetReport(transactions, budgets, new Date()),
    [transactions, budgets],
  );

  const [addCategory, setAddCategory] = useState("");
  const [addLimit, setAddLimit] = useState("");

  const pickerCats = useMemo(
    () =>
      CATEGORIES.filter(
        (c) => !BUDGET_EXCLUDED_CATEGORIES.has(c) && budgets[c] == null,
      ),
    [budgets],
  );

  /** Etichetta mese corrente del report (es. «Settembre 2026»). */
  const monthLabel = (() => {
    const [y, m] = report.month.split("-").map(Number);
    return `${MONTH_IT[(m ?? 1) - 1] ?? report.month} ${y}`;
  })();

  if (transactions.length === 0) {
    return (
      <div className="empty">
        <h2>Nessun movimento</h2>
        <p className="muted">Carica i CSV per confrontare spesa e budget.</p>
        <button type="button" className="btn primary" onClick={onUpload}>
          Carica CSV
        </button>
      </div>
    );
  }

  return (
    <div className="budget-tab">
      <p className="muted budget-month">Mese corrente: {monthLabel}</p>
      <p className="muted tiny">
        Superamenti budget compaiono anche in Consigli
        {onGoConsigli ? (
          <>
            {" · "}
            <button type="button" className="linkish" onClick={onGoConsigli}>
              Apri Consigli
            </button>
          </>
        ) : null}
        .
      </p>

      {report.rows.length === 0 ? (
        <p className="muted">Nessun budget — aggiungi una categoria sotto.</p>
      ) : (
        <div className="budget-list">
          {report.rows.map((row) => (
            <BudgetRowCard key={row.category} row={row} onSave={onSave} />
          ))}
        </div>
      )}

      <section className="stat-section budget-add">
        <h3 className="stat-section-title">Aggiungi budget</h3>
        <div className="budget-add-form">
          <label>
            Categoria
            <select
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value)}
            >
              <option value="">Scegli…</option>
              {pickerCats.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Limite €/mese
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={addLimit}
              onChange={(e) => setAddLimit(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn primary"
            disabled={!addCategory || !addLimit}
            onClick={() => {
              const n = Number(addLimit.replace(",", "."));
              if (!addCategory || !Number.isFinite(n) || n <= 0) return;
              onSave(addCategory, n);
              setAddCategory("");
              setAddLimit("");
            }}
          >
            Salva
          </button>
        </div>
      </section>
    </div>
  );
}

function BudgetRowCard({
  row,
  onSave,
}: {
  row: BudgetRow;
  onSave: (category: string, limit: number | null) => void;
}) {
  const [draft, setDraft] = useState(String(row.limit));
  useEffect(() => {
    setDraft(String(row.limit));
  }, [row.limit]);

  return (
    <div className={`budget-card status-${row.status}`}>
      <div className="liberation-head">
        <span className="liberation-label">{row.category}</span>
        <span className={`budget-badge ${row.status}`}>{STATUS_LABEL[row.status]}</span>
      </div>
      <div className="liberation-progress" aria-hidden>
        <div
          className={`liberation-progress-fill budget-${row.status}`}
          style={{ width: `${Math.min(100, row.pct)}%` }}
        />
      </div>
      <div className="liberation-meta">
        <span>
          {formatEurDisplay(row.spent)} / {formatEurDisplay(row.limit)}
        </span>
        <span className="liberation-remaining">
          {row.status === "over"
            ? `+${formatEurDisplay(row.spent - row.limit)} oltre`
            : `restano ${formatEurDisplay(row.remaining)}`}
        </span>
      </div>
      <span className="stat-hint">{row.pct.toFixed(0)}% del limite</span>
      <div className="vault-override">
        <label className="vault-override-label">
          Limite €
          <input
            type="number"
            min={0.01}
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
            if (!Number.isFinite(n) || n <= 0) return;
            onSave(row.category, n);
          }}
        >
          Aggiorna
        </button>
        <button type="button" className="btn" onClick={() => onSave(row.category, null)}>
          Rimuovi
        </button>
      </div>
    </div>
  );
}
