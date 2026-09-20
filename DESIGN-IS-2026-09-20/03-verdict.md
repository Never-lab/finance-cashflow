# Verdict

**REDESIGN** — Total **14/30** (&lt; 20). No principle scored 0, but load-bearing #4 understandable and #6 honest are weak (1), and density (#10) plus incomplete states/a11y (#8) pull the product below refine threshold.

Bones to keep (tokens, sidebar shell, Italian local-first product) — redesign means **new IA + clarity pass**, not a new brand or rewrite from zero CSS.

## Highest-leverage moves

1. **#4 Understandable** — Fix dual **Margine** (% vs €); replace `monitoring plane` / Leak / Vault jargon with plain Italian. Evidence: `Dashboard.tsx:105-109` vs `CashflowCharts.tsx:328-330`; `LoginScreen.tsx:64`.
2. **#10 Less design** — Collapse or nest nav (Panoramica overcrowded: 5 items); keep one primary **Carica CSV** (shell only). Evidence: `AppShell.tsx:25-32`; Structural “Carica CSV”×11.
3. **#8 Thorough** — Focus-visible rings; modal focus trap + Escape; Dashboard/Transactions loading & error; `aria-live` toasts. Evidence: A11y gaps; Visual states table.
4. **#6 Honest** — Retitle Consigli score (“Punteggio regole locali”); show how Top azioni ranked; soften payslip “allineato” claim. Evidence: `Advisor.tsx:131–173`; `PayslipTab.tsx:149-150`.
5. **#9 Weight** — Lazy-load tab chunks (esp. Recharts tabs) so idle Dashboard is lighter. Evidence: 791 646 B single chunk; static imports `App.tsx:12-24`.

## How to proceed (product)

1. Approve this verdict (or dispute scores with new evidence).
2. Run `/make-plan` using `04-handoff-prompt.md` (paste into next chat).
3. Implement in slices: **IA + copy** → **a11y/states** → **bundle split** — not a big-bang visual restyle.
4. Smoke Playwright on shell + Dashboard + one modal after each slice.
