# Scope — Cash Flow UI/UX audit

- **What:** Entire web UI of Cash Flow (`apps/web/src`) — AppShell, all 10 tabs, Login, Upload/Settings modals. Source-only (no live Lighthouse); `dist/` used for bundle size.
- **Primary user:** Nicholas — personal finance hub (IT), local SQLite + CSV banks.
- **Primary task:** Import bank CSV → understand cash flow (KPI, categories, commitments) without cloud.
- **Constraints:** Keep charcoal/teal/clay tokens in `styles.css`; Italian UI strings; Vite + React; no new UI kit; privacy local-first.
- **Out of scope for this audit:** API/parser correctness, portfolio math accuracy, deploy/auth security (except a11y of login UI).
- **Date:** 2026-09-20
