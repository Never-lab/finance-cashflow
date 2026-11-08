# Cash Flow — Audit AS-IS (ECC pack)

**Date:** 2026-11-08  
**Repo:** `Never-lab/finance-cashflow` (`C:\Users\nicho\Documents\Finance`)  
**Skills applied:** `using-superpowers`, `ecc-guide`, `production-audit`, `codebase-onboarding`, `finance-code-review` (checklist lens), `plankton-code-quality` (harness note only — not installed as write-time gate here)

**Scope:** Runtime app only (`apps/`, `packages/shared/`). Excludes ECC skill tree noise under `.cursor/skills/` unless it affects runtime.

---

## 0. One-line production verdict

**Production audit (personal single-tenant deploy): ~74/100 — launchable with caveats.** Auth optional via env; bank-sync callback + open register + payslip PII on disk + shared quotes cache are the main residual risks. Not a multi-tenant SaaS readiness score.

---

## 1. Product surface (what exists today)

| Area | Status | Entry |
|------|--------|-------|
| Cash flow CSV (Mediolanum/Revolut) | Done | `UploadModal` → `importCsv` → `POST /api/transactions/merge` |
| KPI + charts (Sankey, cumulative, bars, heatmap) | Done | `Dashboard` + `CashflowCharts` |
| Internal transfer exclusion | Done | `internal.ts` + overrides |
| Abbonamenti / ricorrenti | Done | `Recurring` + `recurring.ts` |
| PayPal piani | Done | `PaypalTab` + `paypal.ts` |
| Consigli / advisor | Done | `Advisor` + `advisor.ts` |
| Budget per categoria | Done | `BudgetTab` + `budget.ts` |
| Investimenti (PAC/ETF/…, quotes) | Done | `Investimenti` + instruments/portfolio/quotes API |
| Piano + Vault goals | Done | `PianoTab` + `vaultGoals` / `liberationPlan` / `mediolanumBuffer` |
| Mutui / loans | Done | `LoansTab` + `loans.ts` |
| Scadenzario | Done | `ScadenzarioTab` + `scadenzario.ts` |
| Buste paga PDF | Done | `PayslipTab` + payslips API |
| Auth (optional Railway) | Done | `FINANCE_AUTH=on` + JWT session |
| Bank sync GoCardless | Done | `bankSync` routes + cron |
| Privacy mask amounts | Done | `PrivacyProvider` |
| IndexedDB → SQLite migrate | Done | banner + `POST /api/migrate` |
| Backup JSON / wipe / recompute | Done | `SettingsModal` |

**Tabs (11):** dashboard, consigli, piano, budget, movimenti, bustepaga, scadenzario, abbonamenti, mutui, paypal, investimenti.

---

## 2. Architecture map

```
Browser (Vite :5173)
  App.tsx gate (health → auth? → state)
  UploadModal parses CSV client-side (@shared parsers)
  api.ts → /api/* (proxy → :5174)
Hono API (apps/api)
  authMiddleware (optional)
  SQLite data/finance.db (better-sqlite3)
  Optional GoCardless sync + Yahoo/Finnhub quotes
  Serves dist/ in prod
packages/shared
  Pure domain: parse, categorize, stats, advisor, budget, loans, paypal, vault, …
```

**Stack:** Node ≥22, React 19, Vite 6, Hono, better-sqlite3, recharts, vitest. Single package (no workspaces).

---

## 3. API inventory (47 handlers)

### Auth / health
- `GET /api/health` — liveness + auth flag
- `POST /api/auth/register|login`, `GET /api/auth/me`

### State / cash
- `GET /api/state`, `POST /api/transactions/merge`
- Overrides: category (single+bulk), internal, recurring
- `POST /api/migrate`, `POST /api/recompute`, `GET /api/export`, `POST /api/import`

### Investments
- Instruments CRUD + holding + contributions + link-transaction
- `GET /api/portfolio/summary|history`
- Quotes get/history/refresh

### Domains in settings JSON
- settings, loans/targets, paypal/targets, vault/balances, budget

### Payslips / bank
- payslips list/preview/import/delete
- bank-sync status/link/run + **public** `GET /api/bank-sync/callback`

**Lib pillars:** `stateRepo`, `recomputeRepo`, `instrumentsRepo`, `portfolioMath`, `quotes/*`, `bankSync`+`gocardless`, `payslip*`, `auth*`, `migrations`.

---

## 4. Shared domain inventory (39 modules)

**Pipeline:** detectBank → importCsv → parse* → categorize (+fuel/hospitality/vacation) → detectInternal → mergeImport → forCashflow/forConsumption → stats / recurring / budget / advisor / paypal / loans / vault / scadenzario / liberation / buffer / freshness.

**Test gaps (no dedicated automated test):** `authToken.ts`, `importCsv.ts`, `periodLabels.ts`  
**Covered indirectly:** parsers via `parsers.test.ts`; `appState` via `apps/web/db.merge.test.ts`.  
**No orphan lib modules** — helpers without direct UI import are used by categorize/internal/paypal/loans chains.

---

## 5. UI / client inventory

| Layer | Notes |
|-------|-------|
| `App.tsx` | Orchestrates state, period, targets, lazy tabs, toast, migrate |
| `AppShell` | Grouped sidebar; privacy toggle; upload/settings |
| `api.ts` | Typed client; unused by UI: `updateInstrument`, `getQuote`, `refreshQuotes`, `previewPayslip` |
| Charts | Cashflow + Investimenti + chartTheme |
| A11y | `useDialogA11y` on modals; focus-visible CSS; gaps: confirm dialogs, chart alts, progress `aria-hidden`, no tab URLs |

---

## 6. Risk register (production-audit lenses)

### Blockers / high (personal deploy caveats)
| ID | Severity | Finding | Fix hint |
|----|----------|---------|----------|
| R1 | Important | Bank sync callback unauthenticated; knowledge of `ref` UUID can finalize link | Bind callback to signed state / one-time nonce; rate-limit |
| R2 | Important | Open `register` when auth on (no invite) | Disable register or invite token in prod |
| R3 | Important | Payslip PDFs + salary fields on disk/SQLite | Document backup hygiene; ensure auth always on in deploy |
| R4 | Important | Finnhub key plaintext in `settings` table | Acceptable for single-user; encrypt-at-rest if shared host |
| R5 | Minor→Important if multi-user | `quotes_cache` global (cross-user) | OK for public tickers; document tenancy assumption |

### Data integrity
| ID | Finding |
|----|---------|
| D1 | Dedup by stable tx id; Mediolanum truncated-desc migration exists |
| D2 | PayPal `knownPaypal` can go stale (documented pitfall) |
| D3 | `/api/import` + migrate `force` are destructive — UI double-confirm only |
| D4 | `bank_links` in schema for new DBs; migration path for old DBs needs verify |

### Ops
| ID | Finding |
|----|---------|
| O1 | Health does not probe SQLite open / GoCardless reachability |
| O2 | Daily bank cron unless `BANK_SYNC_CRON=off` |
| O3 | No E2E suite (vitest unit/integration only) |
| O4 | ECC Plankton write-time lint not wired in this repo’s agent hooks |

### UX / product debt
| ID | Finding |
|----|---------|
| U1 | No deep-link / browser history for tabs |
| U2 | Period global on Dashboard; Advisor has own period — inconsistency |
| U3 | Quote refresh API unused in Investimenti UI |
| U4 | Payslip preview API unused |
| U5 | Dense 11-tab mobile nav |
| U6 | Toast no dismiss; can clash with migrate banner |
| U7 | `window.confirm` for destructive Settings actions |

---

## 7. Test & quality evidence (to refresh each loop)

- Vitest configs via `apps/web/vite.config.ts`; ~47 test files spanning shared + api + web.
- Quality gates in repo rules: `npm test` + `npm run build` + `finance-code-review` before done/procedi.
- Roadmap backlog still open: budget advanced alerts; Investimenti T0/T1/T2; Piano waterfall visual.

---

## 8. Function catalog (by capability)

### Import & normalize
`detectBank`, `importCsv`, `parseMediolanum`, `parseRevolut`, `cleanMediolanumDescription`, `transactionId`, `dedupeMediolanumTransactions`, `mapBookedTransaction(s)`, `extractLiquidityFromCsv`

### Classify & filter
`categorize`, `detectInternal` / `resolveInternal` / `forCashflow`, `forConsumption`, fuel/hospitality/vacation heuristics, `isCarLoanTransaction`, known* matchers

### KPI / views
`computeKpis`, `monthlySeries`, `categoryBreakdown`, chart helpers, `buildBudgetReport`, `suggestCategoryBudgets`, `analyzeFinances`, `buildPaypalSummary`, `buildLoanSummary`, `buildVaultGoals`, `buildScadenzario`, `buildLiberationPlan`, `buildMediolanumBuffer`, freshness/checklist helpers

### Persist / API
`loadAppState`, `mergeImportIntoDb`, override setters, `recomputeDatabase`, instrument/contribution CRUD, `buildSummary`/`buildHistory`, quote providers, payslip upsert/storage, bank link/sync

### UI orchestration
Boot gate, tab switch, merge/import, override handlers, privacy mask, settings backup/wipe/recompute/bank-link

---

## 9. ECC pack notes (what was / was not used)

| Skill | Role in this audit |
|-------|--------------------|
| `ecc-guide` | Orient ECC surfaces; prefer skills over command shims |
| `production-audit` | Risk lenses + score format |
| `codebase-onboarding` | Architecture + entry points map |
| `finance-code-review` | Severity/gate language for findings |
| `repo-scan` | Pointer-only skill; **not installed/run** (would clone external tool) |
| `code-tour` | Could produce `.tour` later; not required for prose audit |
| `delivery-gate` / `plankton` | Claude-hook tooling; not active evidence for app code quality |
| `configure-ecc` | Install wizard — out of scope (audit code, not reinstall ECC) |

---

## 10. Recommended fix backlog (as-is, prioritized)

1. **Security deploy defaults:** auth on + disable/lock register; harden bank callback.
2. **Investimenti UX:** wire `refreshQuotes` / live quote affordance.
3. **Payslip:** use or remove `previewPayslip` dead client path.
4. **Tests:** `importCsv` + `authToken` edge cases; smoke auth.integration already present.
5. **Health:** include `dbOk` boolean from SQLite ping.
6. **UX:** tab deep-links; unify period; improve Settings confirms / toast.
7. **A11y:** chart text summaries; progress bars not `aria-hidden` without alternative.
8. **Docs/ops:** rollback note for SQLite file; payslip volume backup.

---

## 11. Agent loop protocol (requested ×5)

Each loop:
1. **Gap×2** — re-check this audit for missing surfaces / wrong claims  
2. **Code×3** — code control (correctness, security, tests)  
3. **Fix×2** — concrete as-is fixes  
4. **UI×2** — UI + existing-function improvements  

Accumulate unique findings; later loops must not only repeat — dig residual gaps.

---

*Baseline audit authored before Loop 1 agents. Append loop digests below after each wave.*

---

## Loop 1 digest (9 agents)

### Gap corrections
- Handlers: **46** (not 47); vitest executes **46** files (`src/lib/officialSimPlan.test.ts` excluded).
- Missed surfaces: `scripts/`, root `src/lib`, `Hobby/`, `railway.toml`/`nixpacks.toml`, incomplete `.env.example` (no GoCardless/`PAYSLIPS_DIR`), payslip schema columns, `investmentSync`/`payslipRefresh`/`pdfExtract`/`loginRateLimit`.
- Session tokens are **HMAC**, not JWT (comment misnomer).
- Function catalog ~65% on money/security-critical names; completeness ~76%.

### Code control
- **Critical (correctness):** Mediolanum dedup not on merge-import path → possible double KPI.
- **Important:** `forConsumption` vs `isNonConsumption` mismatch; override remap collisions; loan remainingDebt/bank snapshot; loan keys null.
- **Security:** auth-off on public host; open register; import/migrate force; public callback; upload size/DoS; XFF rate-limit; no security headers.
- **Tests:** HTTP routes almost untested; silent `{}` on satellite API fail in `App.tsx`; empty catch bank sync after callback.

### Fix backlog P0–P2 (as-is)
1. Dedup Mediolanum on merge
2. Align consumption filters
3. Harden auth deploy (register lock, fail-fast auth-on)
4. Health DB probe + cron retry-after-error
5. Wire or remove dead client APIs
6. `.env.example` completeness
7. Upload size limits / PDF magic bytes

### UI / a11y
- Shared period bar; mobile nav collapse; sticky table headers; scadenzario urgency; toast dismiss
- Modal inert backdrop; replace `window.confirm`; chart `role=img`; heatmap labels; privacy live region

**Evidence:** `npm test` 271 pass / 1 skip; `npm run build` OK (chunk >500kB warning).

---

## Loop 2 digest (9 agents) — residual

### New surfaces
- Untracked `scripts/` prod mutators + `.prod-session.json` token dump; Hobby untracked; `src/lib` outside tsc.
- Railway: `DATABASE_PATH` ephemeral risk; health not path-aware; nixpacks includes devDeps.
- Multi-tab: sessionStorage per-tab; no cross-tab refresh; IDB not cleared after migrate.
- No CSP; Google Fonts CDN; no service worker (by design).

### New correctness / ops
- **Critical:** non-EUR amounts summed as EUR in KPI.
- Cron “Rome 06:00” broken on UTC hosts (`toLocaleString`→`Date` + `toISOString` day).
- `quotes_cache` cross-user; portfolio mixes currencies.
- Race: merge ∥ bankSync → possible duplicate investment links (no UNIQUE on contribution↔tx).
- Soft-delete absent; migrate `ok:true` when skipped.

### Fixes (new)
- Skip non-EUR in `computeKpis`/`monthlySeries`; Rome `formatToParts` for cron; health DB probe; cron set `lastRunDay` after success; clear IDB; gitignore Hobby/script dumps; CSP.

### UI (new)
- Shared EmptyState + first-run hero; persist tab; wire refreshQuotes + previewPayslip; handle `?bank_sync=` query; distinguish load-error vs empty payslips.

---

## Loop 3 digest (9 agents) — domain / schema

### Domain gaps
- Payslip bank_match: EPS €1 too loose; sum-match; month bucket without payDate; category=Stipendio alone.
- Advisor: cancelled marks game score; mixed period horizons (KPI vs impegni vs budget).
- Liberation: Lifecycle = historical credit sum ≠ pocket balance; Avvera truncate drops loan contract key.
- PDF: plain-nonempty blocks anydoc; anydoc errors silent; README inverted; recompute skip counter misleading.

### Schema
- No FK/UNIQUE on `contributions.transaction_id`; `replaceAppState` orphans links.
- No UNIQUE payslip period; UPSERT freezes period_* fields; missing `(user_id,date)` index.

### Fixes
- Tighter bank match EPS + fallback window; don't exclude cancelled if still charged; Lifecycle via pocket estimator; persist rawDescription / fix Avvera key; UNIQUE partial index + migration dedup; cleanup contributions on replaceAppState.

### UI
- Export PenaltyLedger under Advisor hero; scroll to `#piano-liberazione`; Transactions bulk select; Recurring mark labels + filters; Budget status filter.

---

## Loop 4 digest (9 agents) — runtime / privacy / React

### NEW gaps
- Suspense wraps all tabs; no ErrorBoundary; Investimenti quote/contribution/refresh races (stale overwrite).
- Finnhub: no throttle/429; history always hits provider; Yahoo `quote[0]` fragile; provider switch leaves stale cache.
- Privacy mask = amounts only; descriptions/%/bar widths leak; export JSON full PII; script stderr dumps.
- Railway: pdf-parse full buffers + recompute all PDFs; Dashboard pulls recharts into landing chunk.

### Fixes
- AbortController on Investimenti effects; Finnhub spacing + history cache-first; invalidate quotes on provider change; lazy CashflowCharts; ErrorBoundary; safer Yahoo parse; optional description mask; export warn dialog.

### UI
- Privacy extend to descriptions/%; Settings backup PII callout; chart empty≠error; quote loading skeleton; stale price age if available.

---

## Loop 5 digest (9 agents) — deps / docs / polish FINAL

### NEW gaps
- npm audit: hono + @hono/node-server serveStatic/parseBody (prod P0); vite/vitest/shell-quote mostly dev.
- No root LICENSE; CI has test+build but no `npm audit` gate.
- CLAUDE.md drift: “no cloud/auth/OB”, wrong palette, missing tabs, Cash vs Finance path.
- Unsafe money casts: `parseStateJson` weak; API import bypasses it; SQLite `source`/`RecurringMark` casts; GoCardless `as T`.

### Fixes
- Bump hono ≥4.13.17 + @hono/node-server ≥2.1.6; CI audit step; validateAppState shared client+API; typed GC responses; LICENSE + README rollback; rewrite CLAUDE stale claims.

### UI
- Toast timer race + overlap with migrate banner; LoginScreen a11y (h1, alert, disable fields); Suspense aria-busy; focus restore on tab change; Payslip leave table headers; Investimenti label/aria-expanded.

---

## Consolidated priority backlog (all 5 loops)

### P0 — money / security (fix first)
1. Mediolanum dedup on merge-import path  
2. Skip or convert non-EUR in KPI aggregates  
3. Cron Europe/Rome via `formatToParts` (not `toLocaleString`→Date)  
4. Auth-on fail-fast + lock/disable open register in prod  
5. Bump hono / @hono/node-server (serveStatic CVE)  
6. Harden bank callback (`ref` one-shot / signed)

### P1 — integrity / ops
7. Align `forConsumption` with `isNonConsumption`  
8. UNIQUE partial index contributions↔tx + replaceAppState cleanup  
9. Health DB/path probe; cron `lastRunDay` only after success  
10. Payslip bank_match EPS + window window; Advisor cancelled gaming  
11. Clear IDB after migrate; `.env.example` GoCardless/PAYSLIPS  
12. Shared `validateAppState` on import/migrate

### P2 — UX / quality
13. Wire `refreshQuotes` / `previewPayslip` or remove dead client  
14. Shared period + EmptyState first-run; ErrorBoundary; abort races Investimenti  
15. Privacy: optional description/% mask; export PII warning  
16. Lazy CashflowCharts; Finnhub throttle; quote history cache-first  
17. a11y: modal inert, chart names, Login/Payslip alerts, tab focus restore  
18. Fix CLAUDE.md / README drift; LICENSE; CI `npm audit`

### Score (production-audit lens, personal Railway)
**~68–74/100 → Risky / launchable with caveats** after Loop 2–5 evidence (multi-currency Critical + cron TZ + auth/register + CVE). Raise toward 80+ after P0 closed.

### Agent protocol executed
5 loops × (2 gap + 3 code + 2 fix + 2 UI) = **45 agent passes** + baseline inventory. Full notes: this file.
