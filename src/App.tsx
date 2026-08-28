import { useCallback, useEffect, useState } from "react";
import type { AppState, Period, RecurringMark, Transaction } from "./types";
import { loadState } from "./db";
import { withOverrides } from "./lib/appState";
import { clearAuthToken, getAuthToken } from "./lib/authToken";
import { api } from "./api";
import { Dashboard } from "./components/Dashboard";
import { Transactions } from "./components/Transactions";
import { Recurring } from "./components/Recurring";
import { PaypalTab } from "./components/PaypalTab";
import { Advisor } from "./components/Advisor";
import { Investimenti } from "./components/Investimenti";
import { LoginScreen } from "./components/LoginScreen";
import { UploadModal } from "./components/UploadModal";
import { SettingsModal } from "./components/SettingsModal";
import { LoansTab } from "./components/LoansTab";
import { PayslipTab } from "./components/PayslipTab";
import { AppShell, type AppTab } from "./components/AppShell";
import type { LiquidityView } from "./lib/liquidity";
import type { LoanTarget } from "./lib/loans";

type Gate = "loading" | "login" | "app";

export default function App() {
  const [gate, setGate] = useState<Gate>("loading");
  const [authRequired, setAuthRequired] = useState(false);
  const [state, setState] = useState<AppState | null>(null);
  const [liquidity, setLiquidity] = useState<LiquidityView | null>(null);
  const [tab, setTab] = useState<AppTab>("dashboard");
  const [period, setPeriod] = useState<Period>("month");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [migrateCandidate, setMigrateCandidate] = useState<AppState | null>(null);
  const [loanTargets, setLoanTargets] = useState<Record<string, LoanTarget>>({});
  const [dataRefreshKey, setDataRefreshKey] = useState(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadBootState = useCallback(async () => {
    setBootError(null);
    const serverState = await api.getState();
    const { liquidity: liq, ...appState } = serverState;
    setState(appState);
    setLiquidity(liq);
    try {
      setLoanTargets(await api.getLoanTargets());
    } catch {
      setLoanTargets({});
    }
    if (serverState.transactions.length === 0) {
      const idb = await loadState();
      if (idb.transactions.length > 0) setMigrateCandidate(idb);
    } else {
      setMigrateCandidate(null);
    }
  }, []);

  const bootApp = useCallback(async () => {
    setBootError(null);
    try {
      const health = await api.getHealth();
      setAuthRequired(health.auth);

      if (health.auth) {
        if (!getAuthToken()) {
          setGate("login");
          return;
        }
        await api.authMe();
      }

      await loadBootState();
      setGate("app");
    } catch {
      try {
        const health = await api.getHealth();
        if (health.auth) {
          clearAuthToken();
          setState(null);
          setGate("login");
          return;
        }
      } catch {
        /* ignore */
      }
      setBootError("Impossibile caricare i dati dal server.");
      setGate("app");
    }
  }, [loadBootState]);

  useEffect(() => {
    void bootApp();
  }, [bootApp]);

  useEffect(() => {
    const onLogout = () => {
      clearAuthToken();
      setState(null);
      setMigrateCandidate(null);
      setGate("login");
    };
    window.addEventListener("finance-auth-logout", onLogout);
    return () => window.removeEventListener("finance-auth-logout", onLogout);
  }, []);

  const txns = state ? withOverrides(state) : [];

  function onImport(rows: Transaction[], liquidityPatch?: Parameters<typeof api.mergeTransactions>[1]) {
    void api
      .mergeTransactions(rows, liquidityPatch)
      .then(({ added, updated, state: next, liquidity: liq }) => {
        setState(next);
        setLiquidity(liq);
        showToast(`Import: +${added} nuovi, ${updated} aggiornati`);
      })
      .catch(() => showToast("Errore di connessione al server"));
  }

  function onCategory(id: string, category: string) {
    void api.setCategory(id, category).then(setState).catch(() => showToast("Errore di connessione al server"));
  }

  function onCategoryBulk(ids: string[], category: string) {
    if (ids.length === 0) return;
    void api
      .setCategoryBulk(ids, category)
      .then(setState)
      .catch(() => showToast("Errore di connessione al server"));
  }

  function onInternal(id: string, internal: boolean) {
    void api.setInternal(id, internal).then(setState).catch(() => showToast("Errore di connessione al server"));
  }

  function onRecurringMark(key: string, mark: RecurringMark) {
    void api.setRecurring(key, mark).then(setState).catch(() => showToast("Errore di connessione al server"));
  }

  function onLoanTarget(key: string, target: LoanTarget | null) {
    void api
      .setLoanTarget(key, target)
      .then(setLoanTargets)
      .catch(() => showToast("Errore di connessione al server"));
  }

  function onReplace(next: AppState) {
    void api
      .migrate(next, true)
      .then(({ state: applied }) => {
        setState(applied);
        setDataRefreshKey((k) => k + 1);
      })
      .catch(() => showToast("Errore di connessione al server"));
  }

  async function onRecompute(): Promise<string> {
    const { state: next, loanTargets: targets, report, liquidity: liq } = await api.recompute();
    setState(next);
    setLoanTargets(targets);
    setLiquidity(liq);
    setDataRefreshKey((k) => k + 1);
    const msg = `Ricalcolo ok: ${report.categoriesUpdated} categorie, ${report.internalUpdated} interni, ${report.instrumentsRecalced} strumenti${report.investmentContributionsLinked ? `, +${report.investmentContributionsLinked} versamenti PAC` : ""} · ${report.transactions} movimenti`;
    showToast(msg);
    return msg;
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

  function onLogout() {
    clearAuthToken();
    setState(null);
    setMigrateCandidate(null);
    setSettingsOpen(false);
    setGate("login");
  }

  if (gate === "loading") {
    return <div className="boot">Caricamento…</div>;
  }

  if (gate === "login") {
    return <LoginScreen onSuccess={() => void bootApp()} />;
  }

  if (bootError) {
    return (
      <div className="boot">
        <p>{bootError}</p>
        <button type="button" className="btn primary" onClick={() => void bootApp()}>
          Riprova
        </button>
      </div>
    );
  }

  if (!state) {
    return <div className="boot">Caricamento…</div>;
  }

  return (
    <AppShell
      tab={tab}
      onTab={setTab}
      onUpload={() => setUploadOpen(true)}
      onSettings={() => setSettingsOpen(true)}
    >
      {tab === "dashboard" && (
          <Dashboard
            transactions={txns}
            liquidity={liquidity}
            period={period}
            recurringMarks={state.recurringMarks}
            loanTargets={loanTargets}
            onPeriod={setPeriod}
            onUpload={() => setUploadOpen(true)}
            onGoPaypal={() => setTab("paypal")}
            onGoAbbonamenti={() => setTab("abbonamenti")}
            onGoMutui={() => setTab("mutui")}
            onGoInvestimenti={() => setTab("investimenti")}
          />
        )}
        {tab === "bustepaga" && (
          <PayslipTab refreshKey={dataRefreshKey} onToast={showToast} />
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
            categoryOverrides={state.categoryOverrides}
            marks={state.recurringMarks}
            onMark={onRecurringMark}
            onCategoryChange={onCategoryBulk}
            onUpload={() => setUploadOpen(true)}
          />
        )}
        {tab === "mutui" && (
          <LoansTab
            transactions={txns}
            loanTargets={loanTargets}
            onSaveTarget={onLoanTarget}
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
            loanTargets={loanTargets}
            onGoAbbonamenti={() => setTab("abbonamenti")}
            onGoPaypal={() => setTab("paypal")}
            onGoMovimenti={() => setTab("movimenti")}
            onGoMutui={() => setTab("mutui")}
            onGoInvestimenti={() => setTab("investimenti")}
            onGoDashboard={() => setTab("dashboard")}
            onUpload={() => setUploadOpen(true)}
          />
        )}
        {tab === "investimenti" && (
          <Investimenti transactions={txns} refreshKey={dataRefreshKey} />
        )}

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImport={onImport}
      />
      <SettingsModal
        open={settingsOpen}
        state={state}
        authRequired={authRequired}
        onClose={() => setSettingsOpen(false)}
        onReplace={onReplace}
        onRecompute={onRecompute}
        onLogout={onLogout}
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
    </AppShell>
  );
}
