# Open Banking (GoCardless) Implementation Plan

> **For agentic workers:** Inline execution in this session (user: «ok procedi»). TDD on mapper first.

**Goal:** Sync Mediolanum + Revolut via GoCardless Bank Account Data into existing `mergeImportIntoDb` pipeline; CSV remains emergency fallback.

**Architecture:** Settings SCA link → `bank_links` SQLite → fetch Berlin Group tx → `mapOpenBankingTx` → `Transaction[]` → merge. Daily cron (06:00 Europe/Rome) + manual Sync. Secrets server-only.

**Tech Stack:** Hono, better-sqlite3, GoCardless AIS REST (`bankaccountdata.gocardless.com`), Vitest, React Settings UI.

## Global Constraints

- Free GoCardless only; no new npm deps if `fetch` suffices
- `BankSource` stays `mediolanum` | `revolut`
- IDs: `ob|{source}|{ref}` when bank `transactionId`/`entryReference` present; else `transactionId()` from csv.ts
- Booked tx only (skip pending)
- Callback `GET /api/bank-sync/callback` public (identify via `reference`); other bank-sync routes auth-protected
- Rate limit banks ~4 calls/day → cron once daily enough
- UI copy Italian; identifiers English
- No PIS, no auto CSV↔OB historical reconcile

## File map

| File | Role |
|------|------|
| `packages/shared/lib/mapOpenBankingTx.ts` | Berlin Group → Transaction |
| `packages/shared/lib/mapOpenBankingTx.test.ts` | Fixture tests |
| `apps/api/schema.sql` | `bank_links` table |
| `apps/api/lib/bankLinksRepo.ts` | CRUD links |
| `apps/api/lib/gocardless.ts` | Token + requisition + transactions |
| `apps/api/lib/bankSync.ts` | Link finalize + sync all for user |
| `apps/api/routes/bankSync.ts` | HTTP |
| `apps/api/lib/authMiddleware.ts` | Bypass callback |
| `apps/api/app.ts` | Mount routes |
| `apps/api/index.ts` | Daily cron |
| `apps/web/src/api.ts` | Client methods |
| `apps/web/src/components/SettingsModal.tsx` | Collega / Sync UI |
| `README.md` | Env vars |

---

### Task 1: Mapper (TDD)

**Files:** Create `packages/shared/lib/mapOpenBankingTx.ts`, `mapOpenBankingTx.test.ts`

**Produces:**
- `mapBookedTransaction(raw, source: BankSource): Transaction | null`
- `mapBookedTransactions(raws, source): Transaction[]`

- [ ] Failing tests for amount sign, date, id with ref, id without ref, skip missing amount
- [ ] Implement mapper using `categorize` + `detectInternal` + `transactionId`
- [ ] Tests pass

### Task 2: Schema + repo

**Files:** `schema.sql`, `bankLinksRepo.ts`

- [ ] Table `bank_links (user_id, source, requisition_id, reference, institution_id, account_ids TEXT JSON, status, consent_expires_at, last_sync_at, last_error, created_at, updated_at)` PK `(user_id, source)`
- [ ] Repo: upsert pending, mark linked, list linked, update sync result

### Task 3: GoCardless client

**Files:** `gocardless.ts`

- [ ] `getAccessToken()`, `findInstitutionId(country, nameHint)`, `createRequisition(...)`, `getRequisition(id)`, `listTransactions(accountId, dateFrom?)`
- [ ] Env: `GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY`, `BANK_SYNC_REDIRECT_URL`
- [ ] Optional override: `GOCARDLESS_INSTITUTION_MEDIOLANUM`, `GOCARDLESS_INSTITUTION_REVOLUT`

### Task 4: Sync service + routes

**Files:** `bankSync.ts`, `routes/bankSync.ts`, `authMiddleware.ts`, `app.ts`

- [ ] `POST /api/bank-sync/link` `{ source }` → `{ url }`
- [ ] `GET /api/bank-sync/callback?ref=` → finalize LN, redirect `/`
- [ ] `POST /api/bank-sync/run` → sync user links
- [ ] `GET /api/bank-sync/status` → links status for UI
- [ ] On EXPIRED → `needs_reauth`

### Task 5: Cron

**Files:** `index.ts`

- [ ] If secrets present: schedule daily 06:00 Europe/Rome; sync all users with linked accounts
- [ ] Env `BANK_SYNC_CRON=off` disables

### Task 6: UI

**Files:** `api.ts`, `SettingsModal.tsx`

- [ ] Section «Banche (Open Banking)» with Collega Mediolanum/Revolut, Sync ora, status lines

### Task 7: Verify

- [ ] `npm test` + `npm run build`
- [ ] `finance-code-review` → GATE READY
- [ ] Commit+push on «procedi» (already given)

## Self-review

- Spec A/both/cron+button/free/adapter → covered Tasks 1–6
- No TBD
- Types: `BankSource`, `Transaction` consistent
