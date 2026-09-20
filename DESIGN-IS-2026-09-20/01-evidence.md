# Evidence — consolidated (subagents)

## Structural

- Interactive templates ≈ **81** (+ row-scaled controls; 0 `<a>`). Shell: `AppShell.tsx:98-119`.
- Nesting max **5** (App → AppShell → Advisor/Dashboard → child → leaf).
- Repeated patterns: period chips ×2; KPI `stat-row` blocks ×14 across 9 files; empty states ×12; “Carica CSV” ×11.
- Nav IA — 4 groups / 10 tabs: Panoramica (5), Flusso (1), Impegni (3), Patrimonio (1) — `AppShell.tsx:23-49`.

## Visual (INFERRED + CSS)

- Spacing: many rem steps (0.1–4) + orphan `5px` gap; not a tight 4/8 scale.
- Type: **~25** rem sizes; sans Segoe/IBM Plex + serif Iowan for brand/titles.
- Colors: **23** unique literals in `:root` (`styles.css:1-30`).
- Contrast `--ink` on `--bg` ≈ **13.5:1** PASS; `--muted` ≈ **5–5.5:1** PASS AA.
- States: empty strong; focus **missing** (no `:focus` in CSS); Dashboard/Transactions lack loading/error; success mostly App toast; disabled uneven.
- Breakpoints: 560 / 720 / 900 / 960 / 1280 — sidebar collapses ≤900px.

## Copy & honesty

- Inflations: “Salute cash flow” score; “Top azioni”; “allineato all'accredito Mediolanum” (`PayslipTab.tsx:149-150`).
- Dark patterns: none classic; soft risk = score anxiety + “consigliere” persona.
- Jargon: `monitoring plane` (`LoginScreen.tsx:64`), Vault/P0, Leak, P&L, Savings rate, Margine, Stantio, AP/AC.
- Mismatches: **Margine** = % on Dashboard KPI (`Dashboard.tsx:105-109`) vs **€** on Sankey KPI (`CashflowCharts.tsx:328-330`); Fondo emergenza card navigates to Investimenti with “Versato questo mese”.

## Weight & friction

- Initial JS: **791 646 B** (`dist/assets/index-Ci0_B7oH.js`) — single chunk, all tabs imported.
- Dashboard API: **5** (no auth) / **6** (auth) sequential boot; Dashboard itself 0 fetch.
- TTI EST ≈ 900–2500 ms.
- CSS transitions: 4 rules; no `@keyframes`; no `prefers-reduced-motion`; Recharts may animate.
- Idle: 0 toast/modal/badge.

## Accessibility

- Landmarks: `aside` + `nav[aria-label=Sezioni]` + `main`; `aria-current=page` on tabs.
- No skip-link; no focus-ring CSS; modals: `role=dialog` but **no** focus trap / Escape / `aria-modal`.
- Period chips: no `aria-pressed`; toasts no `aria-live`.
