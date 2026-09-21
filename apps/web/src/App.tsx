/**
 * Radice applicativa Cash Flow: orchestrazione boot, autenticazione, stato condiviso
 * e routing tra tab (Dashboard, Piano, Budget, …). Sincronizza tutto con il backend
 * SQLite via `api`; le mutazioni utente aggiornano lo state React dopo ogni risposta.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { AppState, Period, RecurringMark, Transaction } from "@shared/types";
import { loadState } from "./db";
import { withOverrides } from "@shared/lib/appState";
import { clearAuthToken, getAuthToken } from "@shared/lib/authToken";
import { api } from "./api";
import { Dashboard } from "./components/Dashboard";
import { LoginScreen } from "./components/LoginScreen";
import { UploadModal } from "./components/UploadModal";
import { SettingsModal } from "./components/SettingsModal";
import { AppShell, type AppTab } from "./components/AppShell";
import type { LiquidityView } from "@shared/lib/liquidity";
import type { LoanTarget } from "@shared/lib/loans";
import type { VaultBalancesOverride, VaultId } from "@shared/lib/vaultGoals";
import type { CategoryBudgets } from "@shared/lib/budget";

const PianoTab = lazy(() =>
  import("./components/PianoTab").then((m) => ({ default: m.PianoTab })),
);
const BudgetTab = lazy(() =>
  import("./components/BudgetTab").then((m) => ({ default: m.BudgetTab })),
);
const Transactions = lazy(() =>
  import("./components/Transactions").then((m) => ({ default: m.Transactions })),
);
const Recurring = lazy(() =>
  import("./components/Recurring").then((m) => ({ default: m.Recurring })),
);
const PaypalTab = lazy(() =>
  import("./components/PaypalTab").then((m) => ({ default: m.PaypalTab })),
);
const Advisor = lazy(() =>
  import("./components/Advisor").then((m) => ({ default: m.Advisor })),
);
const Investimenti = lazy(() =>
  import("./components/Investimenti").then((m) => ({ default: m.Investimenti })),
);
const LoansTab = lazy(() =>
  import("./components/LoansTab").then((m) => ({ default: m.LoansTab })),
);
const PayslipTab = lazy(() =>
  import("./components/PayslipTab").then((m) => ({ default: m.PayslipTab })),
);

/** Fasi di avvio: caricamento iniziale, schermata login, app operativa. */
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
  /** Stato IndexedDB da proporre se il server non ha movimenti ma il browser sì. */
  const [migrateCandidate, setMigrateCandidate] = useState<AppState | null>(null);
  const [loanTargets, setLoanTargets] = useState<Record<string, LoanTarget>>({});
  const [vaultBalances, setVaultBalances] = useState<VaultBalancesOverride>({});
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudgets>({});
  /** Incrementato dopo migrate/recompute per forzare reload tab che dipendono solo da API (buste paga, investimenti). */
  const [dataRefreshKey, setDataRefreshKey] = useState(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  /** Carica stato principale e risorse satellite (mutui, vault, budget); rileva candidato migrazione IDB. */
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
    try {
      setVaultBalances(await api.getVaultBalances());
    } catch {
      setVaultBalances({});
    }
    try {
      setCategoryBudgets(await api.getCategoryBudgets());
    } catch {
      setCategoryBudgets({});
    }
    // Banner migrazione: server vuoto + dati legacy nel browser → toast con azione onMigrate.
    if (serverState.transactions.length === 0) {
      const idb = await loadState();
      if (idb.transactions.length > 0) setMigrateCandidate(idb);
    } else {
      setMigrateCandidate(null);
    }
  }, []);

  /**
   * Gate auth: health → token obbligatorio → authMe → loadBootState.
   * In errore rete con auth attiva si fa logout; altrimenti messaggio bootError ma gate "app".
   */
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
        /* secondo tentativo health fallito: ignora */
      }
      setBootError("Impossibile caricare i dati dal server.");
      setGate("app");
    }
  }, [loadBootState]);

  useEffect(() => {
    void bootApp();
  }, [bootApp]);

  /** Evento globale emesso da apiFetch su 401: reset stato e torna al login. */
  useEffect(() => {
    const onLogout = () => {
      clearAuthToken();
      setState(null);
      setLiquidity(null);
      setLoanTargets({});
      setVaultBalances({});
      setCategoryBudgets({});
      setMigrateCandidate(null);
      setGate("login");
    };
    window.addEventListener("finance-auth-logout", onLogout);
    return () => window.removeEventListener("finance-auth-logout", onLogout);
  }, []);

  /** Movimenti con categorie/interni applicati (vista usata da quasi tutti i tab). */
  const txns = state ? withOverrides(state) : [];

  /** Handler tab → API: ogni successo aggiorna lo slice di state corrispondente. */
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

  function onVaultBalance(id: VaultId, amount: number | null) {
    void api
      .setVaultBalance(id, amount)
      .then(setVaultBalances)
      .catch(() => showToast("Errore di connessione al server"));
  }

  function onCategoryBudget(category: string, limit: number | null) {
    void api
      .setCategoryBudget(category, limit)
      .then(setCategoryBudgets)
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
    const payslipBit =
      report.payslipsReparsed || report.payslipsSkippedMissingFile
        ? `, ${report.payslipsReparsed ?? 0} cedolini ri-parsati${
            report.payslipsSkippedMissingFile
              ? ` (${report.payslipsSkippedMissingFile} senza PDF — ri-importa)`
              : ""
          }`
        : "";
    const msg = `Ricalcolo ok: ${report.categoriesUpdated} categorie, ${report.internalUpdated} interni, ${report.instrumentsRecalced} strumenti${report.investmentContributionsLinked ? `, +${report.investmentContributionsLinked} versamenti PAC` : ""}${payslipBit} · ${report.transactions} movimenti`;
    showToast(msg);
    return msg;
  }

  /** POST migrate con stato IDB; chiude il banner e sostituisce state server-side. */
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

  /* ——— Render condizionale boot / auth ——— */

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
      authRequired={authRequired}
      onLogout={onLogout}
    >
      <Suspense fallback={<div className="boot">Caricamento…</div>}>
        {tab === "dashboard" && (
          <Dashboard
            transactions={txns}
            liquidity={liquidity}
            period={period}
            onPeriod={setPeriod}
            onUpload={() => setUploadOpen(true)}
          />
        )}
        {tab === "piano" && (
          <PianoTab
            transactions={txns}
            liquidity={liquidity}
            recurringMarks={state.recurringMarks}
            loanTargets={loanTargets}
            vaultBalances={vaultBalances}
            onVaultBalance={onVaultBalance}
            onUpload={() => setUploadOpen(true)}
            onGoPaypal={() => setTab("paypal")}
            onGoAbbonamenti={() => setTab("abbonamenti")}
            onGoMutui={() => setTab("mutui")}
            onGoInvestimenti={() => setTab("investimenti")}
          />
        )}
        {tab === "budget" && (
          <BudgetTab
            transactions={txns}
            budgets={categoryBudgets}
            onSave={onCategoryBudget}
            onUpload={() => setUploadOpen(true)}
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
            categoryBudgets={categoryBudgets}
            onGoAbbonamenti={() => setTab("abbonamenti")}
            onGoPaypal={() => setTab("paypal")}
            onGoMovimenti={() => setTab("movimenti")}
            onGoMutui={() => setTab("mutui")}
            onGoInvestimenti={() => setTab("investimenti")}
            onGoDashboard={() => setTab("dashboard")}
            onGoBudget={() => setTab("budget")}
            onUpload={() => setUploadOpen(true)}
          />
        )}
        {tab === "investimenti" && (
          <Investimenti transactions={txns} refreshKey={dataRefreshKey} />
        )}
      </Suspense>

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
        <div className="toast" role="status" aria-live="polite">
          <span>Trovati dati salvati nel browser ({migrateCandidate.transactions.length} movimenti).</span>{" "}
          <button type="button" className="btn primary" onClick={onMigrate}>
            Migra dati browser → SQLite
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </AppShell>
  );
}
