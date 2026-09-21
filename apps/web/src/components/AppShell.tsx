/**
 * Layout principale: sidebar con navigazione a gruppi (Panoramica, Flusso, Impegni, Patrimonio),
 * titolo pagina, azioni globali (privacy importi, Carica CSV, Dati e backup, Esci se auth).
 */
import type { ReactNode } from "react";
import { usePrivacyAmounts } from "./PrivacyProvider";

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

function EyeIcon({ masked }: { masked: boolean }) {
  if (masked) {
    return (
      <svg className="privacy-eye-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M2.1 3.5 3.5 2.1l18.4 18.4-1.4 1.4-3.1-3.1A11.6 11.6 0 0 1 12 19.5C7 19.5 2.7 16.4 1 12c.7-1.8 1.8-3.4 3.2-4.7L2.1 3.5zm5.6 5.6 1.5 1.5A3 3 0 0 0 12 15a3 3 0 0 0 1.4-.3l1.5 1.5A5 5 0 0 1 7.7 9.1zM12 6.5c1.1 0 2.1.2 3 .6l-1.6 1.6A3 3 0 0 0 9.3 12L7.7 10.4A5 5 0 0 1 12 6.5zm9.8 5.5c-.6 1.5-1.5 2.8-2.7 3.9l-1.5-1.5c.8-.8 1.5-1.7 1.9-2.7C17.9 9.3 15.2 7.5 12 7.5c-.4 0-.8 0-1.2.1L9.2 6C10.1 5.7 11 5.5 12 5.5c5 0 9.3 3.1 11 7.5z"
        />
      </svg>
    );
  }
  return (
    <svg className="privacy-eye-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 5C7 5 2.7 8.1 1 12.5 2.7 16.9 7 20 12 20s9.3-3.1 11-7.5C21.3 8.1 17 5 12 5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 .01 6.01A3 3 0 0 0 12 9.5z"
      />
    </svg>
  );
}

export function AppShell({
  tab,
  onTab,
  onUpload,
  onSettings,
  authRequired = false,
  onLogout,
  children,
}: Props) {
  const { masked, toggle } = usePrivacyAmounts();

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
          <button
            type="button"
            className={`btn sidebar-privacy${masked ? " active" : ""}`}
            onClick={toggle}
            aria-pressed={masked}
            title={masked ? "Mostra importi" : "Nascondi importi"}
          >
            <EyeIcon masked={masked} />
            <span>{masked ? "Mostra importi" : "Nascondi importi"}</span>
          </button>
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
