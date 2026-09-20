# UI/UX Redesign (Rams 14/30) Implementation Plan

> **For agentic workers:** Implement task-by-task. Checkboxes track progress. No new deps. Preserve `styles.css` tokens.

**Goal:** Redesign Cash Flow IA + clarity (not a new brand): fix Margine ambiguity, jargon, nav density, a11y/states, and lazy-load heavy tabs.

**Architecture:** Keep AppShell + charcoal/teal/clay. Regroup nav; Italian primary labels; shared modal a11y helper; `React.lazy` for non-default tabs.

**Tech Stack:** Vite 6, React 19, TypeScript, existing CSS.

## Global Constraints

- Italian UI strings; English identifiers only
- No new UI kit / no new npm deps
- Preserve `:root` color tokens
- Empty states may keep one Carica CSV CTA; remove toolbar duplicates
- Do not commit unless user asks

## File map

| File | Change |
|------|--------|
| `AppShell.tsx` | New nav groups |
| `Dashboard.tsx` | Risparmio %; drop toolbar CSV; liquidity hint |
| `CashflowCharts.tsx` | Margine € label |
| `Advisor.tsx` | Honest score/copy; Spreco |
| `LoginScreen.tsx` / `SettingsModal.tsx` | Drop monitoring plane |
| `PayslipTab.tsx` | Soften alignment claim |
| `PianoTab.tsx` | Vault → Obiettivi risparmio (title) |
| `UploadModal.tsx` / `SettingsModal.tsx` | Escape + focus trap + aria-modal |
| `useDialogA11y.ts` (new) | Shared modal a11y |
| `styles.css` | focus-visible; prefers-reduced-motion |
| `App.tsx` | lazy tabs; Suspense; aria-live toast; chip aria-pressed via children |
| Empty-tab toolbars | Drop duplicate Carica CSV where toolbar duplicates shell |

---

### Task 1: Nav IA + copy (Slice A)

- [x] Regroup `NAV_GROUPS`: Panoramica (Dashboard, Consigli); Pianificazione (Piano, Budget); Flusso (Movimenti, Buste paga); Impegni (3); Patrimonio (Investimenti)
- [x] Dashboard KPI `Margine` → `Risparmio %`; remove toolbar Carica CSV; liquidity empty → muted pointer to sidebar (no second primary)
- [x] Sankey KPI `Margine` → `Margine €`
- [x] Advisor: score label, Savings rate → Quota risparmiata, Leak→Spreco, Top azioni + method hint
- [x] Login/Settings: Accedi a Cash Flow / Esci da questo browser
- [x] Payslip: soften “allineato”
- [x] Piano: Obiettivi Vault → Obiettivi risparmio
- [x] Remove toolbar-level Carica CSV duplicates (keep empty-state CTAs)

### Task 2: Thorough / a11y (Slice B)

- [x] Add `apps/web/src/hooks/useDialogA11y.ts` (Escape, focus trap, restore focus)
- [x] Wire UploadModal + SettingsModal (`aria-modal`, ref)
- [x] `:focus-visible` + `prefers-reduced-motion` in `styles.css`
- [x] Toast/migrate: `role="status"` `aria-live="polite"`
- [x] Period chips: `aria-pressed`

### Task 3: Bundle (Slice C)

- [x] `React.lazy` + `Suspense` for all tabs except Dashboard (eager)
- [x] Fallback: existing `.boot` Caricamento…

### Task 4: Verify

- [x] `npm test` + `npm run build`
- [x] `finance-code-review` → GATE READY
