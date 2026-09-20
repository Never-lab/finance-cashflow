# /make-plan handoff

````
/make-plan Redesign Cash Flow web UI (IA + clarity). Current design failed Rams audit at 14/30 with critical gaps in principles #4 understandable, #6 honest, #8 thorough, #10 as little design as possible.

Verdict paragraph (quoted from 03-verdict.md):
> REDESIGN — Total 14/30 (< 20). No principle scored 0, but load-bearing #4 understandable and #6 honest are weak (1), and density (#10) plus incomplete states/a11y (#8) pull the product below refine threshold. Bones to keep (tokens, sidebar shell, Italian local-first product) — redesign means new IA + clarity pass, not a new brand or rewrite from zero CSS.

Why redesign and not refine: Total below 20 with weak clarity/honesty/density; a polish-only pass would leave the overcrowded Panoramica IA and Margine ambiguity intact.

Preserve from current design (MUST keep):
- Brand tokens charcoal/teal/clay in `apps/web/src/styles.css` `:root` (e.g. `--bg #1c211f`, `--teal #6ecfbc`, `--clay #e07a4a`).
- AppShell layout: sticky sidebar + main page title pattern (`AppShell.tsx`).
- Italian UI language; local-first / no-cloud positioning.
- Existing chart language (Sankey / bars / heatmap) once labels are honest.

Discard (structural patterns causing failures):
- Flat 10-tab density with Panoramica holding 5 peers. Evidence: `AppShell.tsx:25-32`. Caused failure on principle #10.
- Duplicate “Carica CSV” CTAs across empty states while shell already owns upload. Evidence: Structural ×11. Caused failure on #10 / #5.
- Dual metric label “Margine” (% vs €). Evidence: `Dashboard.tsx:105-109` vs `CashflowCharts.tsx:328-330`. Caused failure on #4.
- English/jargon primary labels (`monitoring plane`, Leak, Vault, P&L as primary). Evidence: Copy audit. Caused failure on #4 / #6.
- Missing focus rings, modal trap/Escape, ungated ~792KB single JS chunk. Evidence: A11y + Weight. Caused failure on #8 / #9.

Top 3–5 moves from the audit (verbatim):
1. #4 Understandable: Fix dual Margine (% vs €); replace monitoring plane / Leak / Vault jargon with plain Italian. Evidence: Dashboard.tsx:105-109 vs CashflowCharts.tsx:328-330; LoginScreen.tsx:64.
2. #10 Less design: Collapse or nest nav (Panoramica overcrowded: 5 items); keep one primary Carica CSV (shell only). Evidence: AppShell.tsx:25-32; Carica CSV×11.
3. #8 Thorough: Focus-visible rings; modal focus trap + Escape; Dashboard/Transactions loading & error; aria-live toasts. Evidence: A11y gaps; Visual states.
4. #6 Honest: Retitle Consigli score (“Punteggio regole locali”); show how Top azioni ranked; soften payslip “allineato” claim. Evidence: Advisor.tsx:131,173; PayslipTab.tsx:149-150.
5. #9 Weight: Lazy-load tab chunks (esp. Recharts tabs) so idle Dashboard is lighter. Evidence: 791646 B single chunk; App.tsx:12-24.

Redesign principles in priority order:
1. #4 Understandable — first-time user names every primary control; one label per metric.
2. #10 As little design as possible — fewer top-level destinations; one upload affordance.
3. #8 Thorough — empty/loading/error/success/focus/disabled considered on shell + Dashboard.
4. #6 Honest — scores and rankings disclose method in primary UI.
5. #9 Environmentally friendly — code-split heavy tabs; honor prefers-reduced-motion.

Deliverables for the plan:
- New information architecture (not derived from old flat 10) — propose grouped “more” or secondary routes
- New primary flow (low-fi, labeled, side-by-side vs current shell)
- States checklist (empty, loading, error, success, focus, disabled)
- Migration path for users currently on the old design (same data; bookmark/tab state mapping)
- Cutover criteria (when old nav labels retire)

Anti-patterns to guard against (specific to REDESIGN):
- Porting old structure under new styling
- Keeping both designs behind a flag indefinitely
- Redesigning to follow a trend rather than the principles above
- Treating the Preserve list as optional — brand tokens and Italian local-first must remain
- Inventing a second visual language (no purple gradients / cream-serif marketing)
````
