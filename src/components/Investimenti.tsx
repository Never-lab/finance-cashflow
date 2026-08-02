import { useEffect, useState, type FormEvent } from "react";
import type { Contribution, Instrument, InstrumentType, Transaction } from "../types";
import { api, type InstrumentWithHolding } from "../api";
import { formatEur } from "../lib/stats";

type Props = {
  transactions: Transaction[];
};

const TYPE_LABELS: Record<InstrumentType, string> = {
  pac: "PAC",
  etf: "ETF",
  fondo: "Fondo",
  risparmio: "Risparmio",
  deposito: "Deposito",
};

const CASH_TYPES = new Set<InstrumentType>(["risparmio", "deposito"]);

function instrumentValue(i: InstrumentWithHolding): number {
  return (i.holding?.cashBalance ?? 0) + (i.holding?.costBasis ?? 0);
}

export function Investimenti({ transactions }: Props) {
  const [instruments, setInstruments] = useState<InstrumentWithHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);

  const [name, setName] = useState("");
  const [type, setType] = useState<InstrumentType>("pac");
  const [ticker, setTicker] = useState("");
  const [qtyOrCash, setQtyOrCash] = useState("");
  const [cost, setCost] = useState("");

  const [depDate, setDepDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [depAmount, setDepAmount] = useState("");
  const [depNote, setDepNote] = useState("");
  const [linkTxId, setLinkTxId] = useState("");

  const isCashType = CASH_TYPES.has(type);

  async function refresh() {
    setError(null);
    try {
      const list = await api.listInstruments();
      setInstruments(list);
    } catch {
      setError("Errore di connessione al server");
    }
  }

  useEffect(() => {
    setLoading(true);
    void refresh().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setContributions([]);
      return;
    }
    void api
      .listContributions(selectedId)
      .then(setContributions)
      .catch(() => setError("Errore di connessione al server"));
  }, [selectedId]);

  function resetForm() {
    setName("");
    setType("pac");
    setTicker("");
    setQtyOrCash("");
    setCost("");
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      const created: Instrument = await api.createInstrument({
        name: name.trim(),
        type,
        ticker: ticker.trim() || null,
        currency: "EUR",
      });
      await api.setHolding(created.id, {
        quantity: isCashType ? null : Number(qtyOrCash) || null,
        cashBalance: isCashType ? Number(qtyOrCash) || 0 : null,
        costBasis: isCashType ? 0 : Number(cost) || 0,
      });
      await refresh();
      resetForm();
      setShowAdd(false);
    } catch {
      setError("Errore di connessione al server");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Eliminare questo strumento e tutti i suoi versamenti?")) return;
    try {
      await api.deleteInstrument(id);
      if (selectedId === id) setSelectedId(null);
      await refresh();
    } catch {
      setError("Errore di connessione al server");
    }
  }

  async function onAddContribution(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !depAmount) return;
    try {
      await api.addContribution(selectedId, {
        date: depDate,
        amount: Number(depAmount),
        note: depNote.trim() || null,
      });
      setDepAmount("");
      setDepNote("");
      const [list, contribs] = await Promise.all([
        api.listInstruments(),
        api.listContributions(selectedId),
      ]);
      setInstruments(list);
      setContributions(contribs);
    } catch {
      setError("Errore di connessione al server");
    }
  }

  async function onDeleteContribution(id: string) {
    if (!selectedId) return;
    if (!confirm("Eliminare questo versamento?")) return;
    try {
      await api.deleteContribution(id);
      const [list, contribs] = await Promise.all([
        api.listInstruments(),
        api.listContributions(selectedId),
      ]);
      setInstruments(list);
      setContributions(contribs);
    } catch {
      setError("Errore di connessione al server");
    }
  }

  async function onLinkTransaction() {
    if (!selectedId || !linkTxId) return;
    try {
      await api.linkTransaction(selectedId, linkTxId);
      setLinkTxId("");
      const [list, contribs] = await Promise.all([
        api.listInstruments(),
        api.listContributions(selectedId),
      ]);
      setInstruments(list);
      setContributions(contribs);
    } catch {
      setError("Errore di connessione al server");
    }
  }

  const patrimonio = instruments.reduce((s, i) => s + instrumentValue(i), 0);
  const selected = instruments.find((i) => i.id === selectedId) ?? null;
  const linkedTxIds = new Set(contributions.map((c) => c.transactionId).filter(Boolean));
  const linkableTx = transactions
    .filter((t) => t.internal && !linkedTxIds.has(t.id))
    .slice(0, 200);

  if (loading) {
    return <div className="boot">Caricamento…</div>;
  }

  return (
    <div className="investimenti">
      <div className="stat-row recurring-kpis">
        <div className="stat-card">
          <span className="stat-label">Patrimonio (stima)</span>
          <span className="stat-value">{formatEur(patrimonio)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Strumenti</span>
          <span className="stat-value">{String(instruments.length)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Versamenti collegati</span>
          <span className="stat-value">
            {String(instruments.length > 0 ? contributions.length : 0)}
          </span>
        </div>
      </div>
      <p className="muted kpi-note">
        Valore ≈ versato finché non è collegato un prezzo di mercato (arriva in un
        prossimo aggiornamento).
      </p>

      {error && <p className="error">{error}</p>}

      <div className="toolbar">
        <h3 className="stat-section-title">Strumenti</h3>
        <button type="button" className="btn primary" onClick={() => setShowAdd((s) => !s)}>
          {showAdd ? "Annulla" : "+ Aggiungi strumento"}
        </button>
      </div>

      {showAdd && (
        <form className="panel" onSubmit={(e) => void onAdd(e)}>
          <label className="field">
            Nome
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. PAC Msci World"
              required
            />
          </label>
          <label className="field">
            Tipo
            <select value={type} onChange={(e) => setType(e.target.value as InstrumentType)}>
              {(Object.keys(TYPE_LABELS) as InstrumentType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Ticker (opzionale)
            <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="Es. SWDA" />
          </label>
          <label className="field">
            {isCashType ? "Saldo attuale (€)" : "Quantità (opzionale)"}
            <input
              type="number"
              step="any"
              value={qtyOrCash}
              onChange={(e) => setQtyOrCash(e.target.value)}
            />
          </label>
          {!isCashType && (
            <label className="field">
              Versato finora (€)
              <input type="number" step="any" value={cost} onChange={(e) => setCost(e.target.value)} />
            </label>
          )}
          <div className="modal-actions">
            <button type="submit" className="btn primary">
              Salva strumento
            </button>
          </div>
        </form>
      )}

      {instruments.length === 0 ? (
        <div className="empty">
          <h2>Nessuno strumento</h2>
          <p className="muted">Aggiungi un PAC, ETF, fondo, conto risparmio o deposito.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Ticker</th>
                <th className="num">Qty / Saldo</th>
                <th className="num">Versato ≈ Valore</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {instruments.map((i) => (
                <tr
                  key={i.id}
                  className={selectedId === i.id ? "row-could" : undefined}
                >
                  <td>{i.name}</td>
                  <td>
                    <span className="tag">{TYPE_LABELS[i.type]}</span>
                  </td>
                  <td>{i.ticker ?? "—"}</td>
                  <td className="num">
                    {i.holding?.quantity ?? i.holding?.cashBalance ?? 0}
                  </td>
                  <td className="num">{formatEur(instrumentValue(i))}</td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setSelectedId(selectedId === i.id ? null : i.id)}
                    >
                      {selectedId === i.id ? "Chiudi" : "Dettagli"}
                    </button>{" "}
                    <button type="button" className="btn danger" onClick={() => void onDelete(i.id)}>
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <section className="panel invest-detail">
          <h3>{selected.name} — versamenti</h3>

          {contributions.length === 0 ? (
            <p className="muted">Nessun versamento registrato.</p>
          ) : (
            <div className="table-wrap flat">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th className="num">Importo</th>
                    <th>Nota</th>
                    <th>Movimento collegato</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((c) => (
                    <tr key={c.id}>
                      <td>{c.date}</td>
                      <td className="num pos">{formatEur(c.amount)}</td>
                      <td>{c.note ?? "—"}</td>
                      <td>{c.transactionId ? "Sì" : "—"}</td>
                      <td>
                        <button
                          type="button"
                          className="btn danger"
                          onClick={() => void onDeleteContribution(c.id)}
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form className="invest-spaced" onSubmit={(e) => void onAddContribution(e)}>
            <label className="field">
              Data
              <input type="date" value={depDate} onChange={(e) => setDepDate(e.target.value)} required />
            </label>
            <label className="field">
              Importo (€)
              <input
                type="number"
                step="any"
                value={depAmount}
                onChange={(e) => setDepAmount(e.target.value)}
                required
              />
            </label>
            <label className="field">
              Nota (opzionale)
              <input value={depNote} onChange={(e) => setDepNote(e.target.value)} />
            </label>
            <button type="submit" className="btn primary">
              Registra versamento
            </button>
          </form>

          <div className="field invest-spaced">
            Collega movimento (interni disponibili: {linkableTx.length})
            <div className="toolbar wrap">
              <select value={linkTxId} onChange={(e) => setLinkTxId(e.target.value)}>
                <option value="">Seleziona movimento…</option>
                {linkableTx.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.date} · {t.description.slice(0, 40)} · {formatEur(t.amount)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn"
                disabled={!linkTxId}
                onClick={() => void onLinkTransaction()}
              >
                Collega movimento
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
