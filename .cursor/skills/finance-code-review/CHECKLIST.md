# Finance review checklist

Apply every item that the diff touches. Skip items with no relevant files.

## Privacy / data

- [ ] No real bank CSV, PII exports, `data/*.db`, `.env`, or API keys added to the diff
- [ ] Finnhub / quote secrets stay server-side only (never Vite client bundle)
- [ ] Sample fixtures remain anonymized; gitignore covers real exports

## Correctness / cash flow

- [ ] Amount signs stay consistent (+ income, − expense, EUR)
- [ ] Internal transfers / overrides not double-counted in KPI when relevant
- [ ] Dedup / `mergeImport` / transaction `id` stability preserved on re-import
- [ ] Category / internal / recurring overrides survive re-import paths touched
- [ ] No obvious NaN, wrong date parse, or timezone slip on `YYYY-MM-DD`

## CSV / parsers

- [ ] Mediolanum / Revolut detect + header / preamble changes update tests + fixtures
- [ ] Parser changes have or update `packages/shared/lib/*.test.ts` coverage for the edge case
- [ ] Description cleaning does not drop needed merchant signal without reason

## API / SQLite

- [ ] Hono routes match existing `/api/*` patterns; errors don't leak stack/PII
- [ ] Schema / migrate changes are backward-safe for local `data/finance.db`
- [ ] better-sqlite3 usage: no accidental async assumptions; statements closed/scoped like neighbors
- [ ] Auth/deploy paths (if touched) still answer `/api/health`

## Investimenti

- [ ] Portfolio math / holdings / contributions changes are consistent with summary/history APIs
- [ ] Quote provider changes don't hard-require Finnhub; Yahoo remains default
- [ ] No client-side secret for market data

## UI

- [ ] Visual language matches `styles.css` (charcoal / teal / clay); no new UI kit
- [ ] Italian copy consistent with neighboring screens
- [ ] Layout/sidebar/tabs not broken; smoke noted if structure changed (Playwright ok)
- [ ] No accessibility regress on primary actions (import, period, settings) when touched

## Tests / verify

- [ ] Logic changes have or update vitest coverage as appropriate
- [ ] `npm test` and `npm run build` green (or exact blocker stated)
- [ ] No flaky timing assumptions without need

## Git / agent hygiene

- [ ] No `Co-authored-by: Cursor` in commits destined for push
- [ ] Diff does not dump unrelated reformatting
- [ ] PR/issue English (if any): short, concrete (`no-ai-slop`)
