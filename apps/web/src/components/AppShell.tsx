/**
 * Layout principale: sidebar con navigazione a gruppi (Panoramica, Flusso, Impegni, Patrimonio),
 * titolo pagina, azioni globali (privacy importi, Carica CSV, Dati e backup, Esci se auth).
 * ≤900px: sidebar diventa drawer overlay (hamburger + backdrop).
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePrivacyAmounts } from "./PrivacyProvider";

/** Identificativi tab sincronizzati con lo state `tab` in App.tsx. */
export type AppTab =
  | "dashboard"
  | "piano"
  | "budget"
  | "bustepaga"
  | "movimenti"
  | "scadenzario"
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
      { id: "scadenzario", label: "Scadenzario" },
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
  scadenzario: "Scadenzario",
  abbonamenti: "Abbonamenti",
  mutui: "Mutui",
  paypal: "PayPal",
  consigli: "Consigli",
  investimenti: "Investimenti",
};

const MOBILE_NAV_MQ = "(max-width: 900px)";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg className="shell-menu-icon" viewBox="0 0 24 24" aria-hidden="true">
      {open ? (
        <path
          fill="currentColor"
          d="M18.3 5.7 13 11l5.3 5.3-1.4 1.4L11.6 12.4 6.3 17.7 4.9 16.3 10.2 11 4.9 5.7 6.3 4.3l5.3 5.3 5.3-5.3z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"
        />
      )}
    </svg>
  );
}

function readMobileNav(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(MOBILE_NAV_MQ).matches;
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
  const [navOpen, setNavOpen] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(readMobileNav);
  const sidebarId = useId();
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const drawerActive = isMobileNav && navOpen;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(MOBILE_NAV_MQ);
    const sync = () => {
      setIsMobileNav(mq.matches);
      if (!mq.matches) setNavOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /** External setTab (Consigli → PayPal, ecc.) must close overlay. */
  useEffect(() => {
    setNavOpen(false);
  }, [tab]);

  useEffect(() => {
    if (!drawerActive) return;
    const sidebar = sidebarRef.current;
    const focusables = () =>
      sidebar
        ? Array.from(sidebar.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
          )
        : [];

    const first = focusables()[0];
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      // Prefer open modal (mounted outside AppShell) over drawer trap/Escape.
      if (document.querySelector('.modal-backdrop [role="dialog"]')) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setNavOpen(false);
        return;
      }
      if (e.key !== "Tab" || !sidebar) return;
      const list = focusables();
      if (list.length === 0) return;
      const firstEl = list[0]!;
      const lastEl = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      if (document.body.style.overflow === "hidden") {
        document.body.style.overflow = prevOverflow;
      }
      menuBtnRef.current?.focus({ preventScroll: true });
    };
  }, [drawerActive]);

  const selectTab = (next: AppTab) => {
    onTab(next);
    setNavOpen(false);
  };

  const withNavClose = (fn: () => void) => () => {
    setNavOpen(false);
    fn();
  };

  return (
    <div className={`app-shell${drawerActive ? " nav-open" : ""}`}>
      {drawerActive && (
        <button
          type="button"
          className="nav-backdrop"
          tabIndex={-1}
          aria-label="Chiudi menu"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        ref={sidebarRef}
        id={sidebarId}
        className="sidebar"
        aria-label="Navigazione principale"
        {...(drawerActive
          ? { role: "dialog" as const, "aria-modal": true as const }
          : {})}
        inert={isMobileNav && !navOpen ? true : undefined}
        aria-hidden={isMobileNav && !navOpen ? true : undefined}
      >
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
                      onClick={() => selectTab(item.id)}
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
          <button
            type="button"
            className="btn primary sidebar-upload"
            onClick={withNavClose(onUpload)}
          >
            Carica CSV
          </button>
          <button
            type="button"
            className="btn sidebar-settings"
            onClick={withNavClose(onSettings)}
          >
            Dati e backup
          </button>
        </div>
      </aside>

      <div className="main-shell">
        <header className="main-head">
          <div className="main-head-start">
            <button
              ref={menuBtnRef}
              type="button"
              className="btn shell-menu-btn"
              aria-expanded={isMobileNav ? navOpen : false}
              aria-controls={sidebarId}
              aria-haspopup="dialog"
              aria-label={navOpen ? "Chiudi menu" : "Apri menu"}
              onClick={() => {
                if (document.querySelector('.modal-backdrop [role="dialog"]')) return;
                setNavOpen((v) => !v);
              }}
            >
              <MenuIcon open={navOpen} />
            </button>
            <h1 className="page-title">{PAGE_TITLES[tab]}</h1>
          </div>
          {authRequired && onLogout && (
            <button type="button" className="btn danger header-logout" onClick={onLogout}>
              Esci
            </button>
          )}
        </header>
        {/* Header stays interactive (hamburger z-index above backdrop); body inert. */}
        <div
          className="main-body"
          inert={drawerActive ? true : undefined}
          aria-hidden={drawerActive ? true : undefined}
        >
          <main id="main-content" className="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export { PAGE_TITLES };
