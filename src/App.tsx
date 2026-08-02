import { useCallback, useEffect, useState } from "react";
import type { AppState, Period, RecurringMark, Transaction } from "./types";
import {
  loadState,
  mergeImport,
  saveState,
  setCategoryOverride,
  setInternalOverride,
  setRecurringMark,
  withOverrides,
} from "./db";
import { Dashboard } from "./components/Dashboard";
import { Transactions } from "./components/Transactions";
import { Recurring } from "./components/Recurring";
import { PaypalTab } from "./components/PaypalTab";
import { Advisor } from "./components/Advisor";
import { UploadModal } from "./components/UploadModal";
import { SettingsModal } from "./components/SettingsModal";

type Tab = "dashboard" | "movimenti" | "abbonamenti" | "paypal" | "consigli";

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [period, setPeriod] = useState<Period>("month");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void loadState().then(setState);
  }, []);

  const persist = useCallback(async (next: AppState) => {
    setState(next);
    await saveState(next);
  }, []);

  const txns = state ? withOverrides(state) : [];

  function onImport(rows: Transaction[]) {
    if (!state) return;
    const { state: next, added, updated } = mergeImport(state, rows);
    void persist(next);
    setToast(`Import: +${added} nuovi, ${updated} aggiornati`);
    setTimeout(() => setToast(null), 4000);
  }

  function onCategory(id: string, category: string) {
    if (!state) return;
    void persist(setCategoryOverride(state, id, category));
  }

  function onInternal(id: string, internal: boolean) {
    if (!state) return;
    void persist(setInternalOverride(state, id, internal));
  }

  function onRecurringMark(key: string, mark: RecurringMark) {
    if (!state) return;
    void persist(setRecurringMark(state, key, mark));
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
        onReplace={(next) => void persist(next)}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
