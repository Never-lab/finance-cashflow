# Cash Flow Dashboard Implementation Plan

> **For agentic workers:** Use inline execution in this session. Steps use checkbox syntax.

**Goal:** Local Vite+React SPA that imports Mediolanum + Revolut Pocket CSVs and shows cash-flow KPIs, charts, and transactions (IndexedDB).

**Architecture:** Browser-only. CSV → detect/parse → normalize → IndexedDB → React views.

**Tech Stack:** Vite, React 19, TypeScript, idb-keyval, recharts, Vitest.

## Global Constraints

- UI in Italian
- Amounts in EUR; `amount > 0` income, `< 0` expense
- Dedup by stable `id`
- No backend, no cloud
- Mediolanum: flexible IT CSV (`;` or `,`; headers like Data/Descrizione/Importo) — native bank CSV is inconsistent; heuristic parser + clear error
- Revolut: official CSV columns; only `COMPLETED` rows
- YAGNI: no budget, no investments, no auth

## File map

| File | Responsibility |
|------|----------------|
| `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html` | Tooling |
| `src/main.tsx`, `src/App.tsx`, `src/styles.css` | Shell + routing tabs |
| `src/types.ts` | `Transaction`, `BankSource`, period types |
| `src/db.ts` | IndexedDB get/set transactions + categoryOverrides |
| `src/lib/csv.ts` | Split rows, parse EU/US numbers & dates |
| `src/lib/detectBank.ts` | Heuristic bank detection |
| `src/lib/parseRevolut.ts` | Revolut/Pocket parser |
| `src/lib/parseMediolanum.ts` | Mediolanum/generic IT parser |
| `src/lib/categorize.ts` | Keyword rules → category |
| `src/lib/stats.ts` | KPIs, monthly series, category totals |
| `src/lib/id.ts` | Stable transaction id |
| `src/components/Dashboard.tsx` | KPIs + charts |
| `src/components/Transactions.tsx` | Table + filters + category edit |
| `src/components/UploadModal.tsx` | Upload / preview / confirm |
| `src/lib/*.test.ts` | Parser + stats tests |
| `fixtures/*.csv` | Sample CSVs for tests |

---

### Task 1: Scaffold + types + csv helpers

**Files:** create tooling + `src/types.ts`, `src/lib/csv.ts`, `src/lib/id.ts` + tests

- [ ] **Step 1:** `npm create vite@latest . -- --template react-ts` in Finance root (or `app/` subfolder if root polluted). Prefer `C:\Users\nicho\Documents\Finance` as app root; keep `docs/` alongside.
- [ ] **Step 2:** Add deps: `idb-keyval`, `recharts`, `vitest` (+ vite config test).
- [ ] **Step 3:** Implement types, `parseAmount`, `parseDate`, `parseCsvTable`, `transactionId`.
- [ ] **Step 4:** Vitest for amount/date/id.

### Task 2: Parsers + categorize + detect

**Files:** `detectBank.ts`, `parseRevolut.ts`, `parseMediolanum.ts`, `categorize.ts`, fixtures, tests

- [ ] **Step 1:** Fixtures for Revolut COMPLETED rows and Mediolanum `;` CSV.
- [ ] **Step 2:** Parsers return `Transaction[]` (category via categorize).
- [ ] **Step 3:** Tests: row counts, signs, skip non-COMPLETED, dedup ids stable.

### Task 3: DB + stats

**Files:** `db.ts`, `stats.ts` + tests for stats

- [ ] **Step 1:** `loadState` / `saveTransactions` / `setCategoryOverride` / `mergeImport` (skip existing ids, apply overrides).
- [ ] **Step 2:** `computeKpis`, `monthlySeries`, `categoryBreakdown` for a period filter.

### Task 4: UI

**Files:** `App.tsx`, `Dashboard.tsx`, `Transactions.tsx`, `UploadModal.tsx`, `styles.css`

- [ ] **Step 1:** Tabs Dashboard | Movimenti; period select; upload button.
- [ ] **Step 2:** Charts with recharts; empty state CTA.
- [ ] **Step 3:** Upload modal with bank override + preview.
- [ ] **Step 4:** Transactions filters + category `<select>`.

### Task 5: Verify

- [ ] `npm test` pass
- [ ] `npm run build` pass
- [ ] `npm run dev` — smoke with fixtures
- [ ] Forge Loop self-check; brief note to user

**Commit:** only if user asks (repo may be uninitialized).
