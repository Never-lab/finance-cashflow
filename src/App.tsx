import { useCallback, useEffect, useState } from "react";
import type { AppState, Period, RecurringMark, Transaction } from "./types";
import { loadState } from "./db";
import { withOverrides } from "./lib/appState";
import { api } from "./api";
import { Dashboard } from "./components/Dashboard";
import { Transactions } from "./components/Transactions";
import { Recurring } from "./components/Recurring";
import { PaypalTab } from "./components/PaypalTab";
import { Advisor } from "./components/Advisor";
import { Investimenti } from "./components/Investimenti";
import { UploadModal } from "./components/UploadModal";
import { SettingsModal } from "./components/SettingsModal";

type Tab = "dashboard" | "movimenti" | "abbonamenti" | "paypal" | "consigli" | "investimenti";

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [period, setPeriod] = useState<Period>("month");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [migrateCandidate, setMigrateCandidate] = useState<AppState | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadBootState = useCallback(async () => {
    setBootError(null);
    try {
      const serverState = await api.getState();
      setState(serverState);
      if (serverState.transactions.length === 0) {
        const idb = await loadState();
        if (idb.transactions.length > 0) setMigrateCandidate(idb);
      }
    } catch {
      setBootError("Impossibile caricare i dati dal server.");
    }
  }, []);

  useEffect(() => {
    void loadBootState();
  }, [loadBootState]);

  const txns = state ? withOverrides(state) : [];

  function onImport(rows: Transaction[]) {
    void api
      .mergeTransactions(rows)
      .then(({ added, updated, state: next }) => {
        setState(next);
        showToast(`Import: +${added} nuovi, ${updated} aggiornati`);
      })
      .catch(() => showToast("Errore di connessione al server"));
  }

  function onCategory(id: string, category: string) {
    void api.setCategory(id, category).then(setState).catch(() => showToast("Errore di connessione al server"));
  }

  function onInternal(id: string, internal: boolean) {
    void api.setInternal(id, internal).then(setState).catch(() => showToast("Errore di connessione al server"));
  }

  function onRecurringMark(key: string, mark: RecurringMark) {
    void api.setRecurring(key, mark).then(setState).catch(() => showToast("Errore di connessione al server"));
  }

  function onReplace(next: AppState) {
    void api
      .migrate(next, true)
      .then(({ state: applied }) => setState(applied))
      .catch(() => showToast("Errore di connessione al server"));
  }

  function onMigrate() {
    if (!migrateCandidate) return;
    void api
      .migrate(migrateCandidate)
      .then(({ state: applied }) => {
        setState(applied);
        setMigrateCandidate(null);
        showToast("Dati migrati dal browser a SQLite");
      })
      .catch(() => showToast("Errore di connessione al server"));
  }

  if (bootError) {
    return (
      <div className="boot">
        <p>{bootError}</p>
        <button type="button" className="btn primary" onClick={() => void loadBootState()}>
          Riprova
        </button>
      </div>
    );
  }

  if (!state) {
    return <div className="boot">Caricamento…</div>;
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="brand">Cash Flow</p>
          <p className="tagline">Mediolanum + Revolut · tutto in locale</p>
        </div>
        <div className="top-right">
          <nav className="tabs">
            {(
              [
                ["dashboard", "Dashboard"],
                ["movimenti", "Movimenti"],
                ["abbonamenti", "Abbonamenti"],
                ["paypal", "PayPal"],
                ["consigli", "Consigli"],
                ["investimenti", "Investimenti"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? "tab active" : "tab"}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="btn"
            title="Dati e backup"
            onClick={() => setSettingsOpen(true)}
          >
            Dati
          </button>
        </div>
      </header>

      <main>
        {tab === "dashboard" && (
          <Dashboard
            transactions={txns}
            period={period}
            recurringMarks={state.recurringMarks}
            onPeriod={setPeriod}
            onUpload={() => setUploadOpen(true)}
            onGoPaypal={() => setTab("paypal")}
            onGoAbbonamenti={() => setTab("abbonamenti")}
          />
        )}
        {tab === "movimenti" && (
          <Transactions
            transactions={txns}
            categoryOverrides={state.categoryOverrides}
            onCategoryChange={onCategory}
            onInternalChange={onInternal}
            onUpload={() => setUploadOpen(true)}
          />
        )}
        {tab === "abbonamenti" && (
          <Recurring
            transactions={txns}
            marks={state.recurringMarks}
            onMark={onRecurringMark}
            onUpload={() => setUploadOpen(true)}
          />
        )}
        {tab === "paypal" && (
          <PaypalTab transactions={txns} onUpload={() => setUploadOpen(true)} />
        )}
        {tab === "consigli" && (
          <Advisor
            transactions={txns}
            recurringMarks={state.recurringMarks}
            onGoAbbonamenti={() => setTab("abbonamenti")}
            onGoPaypal={() => setTab("paypal")}
            onGoMovimenti={() => setTab("movimenti")}
            onUpload={() => setUploadOpen(true)}
          />
        )}
        {tab === "investimenti" && <Investimenti transactions={txns} />}
      </main>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImport={onImport}
      />
      <SettingsModal
        open={settingsOpen}
        state={state}
        onClose={() => setSettingsOpen(false)}
        onReplace={onReplace}
      />

      {migrateCandidate && (
        <div className="toast">
          <span>Trovati dati salvati nel browser ({migrateCandidate.transactions.length} movimenti).</span>{" "}
          <button type="button" className="btn primary" onClick={onMigrate}>
            Migra dati browser → SQLite
          </button>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
