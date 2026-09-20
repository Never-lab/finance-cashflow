/**
 * Layout principale: sidebar con navigazione a gruppi (Panoramica, Flusso, Impegni, Patrimonio),
 * titolo pagina, azioni globali (Carica CSV, Dati e backup, Esci se auth).
 */
import type { ReactNode } from "react";

/** Identificativi tab sincronizzati con lo state `tab` in App.tsx. */
export type AppTab =
  | "dashboard"
  | "piano"
  | "budget"
  | "bustepaga"
  | "movimenti"
  | "abbonamenti"
  | "mutui"
  | "paypal"
  | "consigli"
  | "investimenti";

type NavItem = { id: AppTab; label: string };

/** Struttura menu laterale: raggruppa i tab per area funzionale dell'app. */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Panoramica",
    items: [
      { id: "dashboard", label: "Dashboard" },
      { id: "consigli", label: "Consigli" },
    ],
  },
  {
    label: "Pianificazione",
    items: [
      { id: "piano", label: "Piano" },
      { id: "budget", label: "Budget" },
    ],
  },
  {
    label: "Flusso",
    items: [
      { id: "movimenti", label: "Movimenti" },
      { id: "bustepaga", label: "Buste paga" },
    ],
  },
  {
    label: "Impegni",
    items: [
      { id: "abbonamenti", label: "Abbonamenti" },
      { id: "mutui", label: "Mutui" },
      { id: "paypal", label: "PayPal" },
    ],
  },
  {
    label: "Patrimonio",
    items: [{ id: "investimenti", label: "Investimenti" }],
  },
];

const PAGE_TITLES: Record<AppTab, string> = {
  dashboard: "Dashboard",
  piano: "Piano",
  budget: "Budget",
  bustepaga: "Buste paga",
  movimenti: "Movimenti",
  abbonamenti: "Abbonamenti",
  mutui: "Mutui",
  paypal: "PayPal",
  consigli: "Consigli",
  investimenti: "Investimenti",
};

type Props = {
  tab: AppTab;
  onTab: (tab: AppTab) => void;
  onUpload: () => void;
  onSettings: () => void;
  authRequired?: boolean;
  onLogout?: () => void;
  children: ReactNode;
};

export function AppShell({
  tab,
  onTab,
  onUpload,
  onSettings,
  authRequired = false,
  onLogout,
  children,
}: Props) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="brand">Cash Flow</p>
        </div>

        <nav className="sidebar-nav" aria-label="Sezioni">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="nav-group">
              <p className="nav-group-label">{group.label}</p>
              <ul className="nav-list">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={tab === item.id ? "nav-link active" : "nav-link"}
                      onClick={() => onTab(item.id)}
                      aria-current={tab === item.id ? "page" : undefined}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button type="button" className="btn primary sidebar-upload" onClick={onUpload}>
            Carica CSV
          </button>
          <button type="button" className="btn sidebar-settings" onClick={onSettings}>
            Dati e backup
          </button>
        </div>
      </aside>

      <div className="main-shell">
        <header className="main-head">
          <h1 className="page-title">{PAGE_TITLES[tab]}</h1>
          {authRequired && onLogout && (
            <button type="button" className="btn danger header-logout" onClick={onLogout}>
              Esci
            </button>
          )}
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}

export { PAGE_TITLES };
