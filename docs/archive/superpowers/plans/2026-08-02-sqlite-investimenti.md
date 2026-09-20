# SQLite + Investimenti Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistenza SQLite via mini-server locale, migrazione da IndexedDB, tab Investimenti (PAC/risparmi) con dashboard mercato (Yahoo + Finnhub opzionale).

**Architecture:** Vite UI (`:5173`) proxy `/api` → Hono Node (`:5174`) + `better-sqlite3` file `data/finance.db`. Parse CSV resta in client; persistenza e portfolio/quote sul server. Fasi F1 → F2 → F3.

**Tech Stack:** Vite 6, React 19, TypeScript, Hono + `@hono/node-server`, `better-sqlite3`, `recharts`, Vitest, `concurrently`, `tsx`.

## Global Constraints

- UI in italiano; design system esistente (`styles.css` teal/clay) — non stravolgere
- Amounts EUR; `amount > 0` entrata, `< 0` uscita
- Dedup transaction `id` stabile; upsert `mergeImport` come oggi
- API key mercato solo sul server (mai nel bundle)
- Yahoo default; Finnhub se `market_api_key` in settings
- Fondi senza ticker: saldo manuale, niente chart mercato
- Storico portafoglio v1: `qty_corrente × close[t]` + cash (qty non ricostruita nel tempo)
- YAGNI: no Postgres, Electron, trading, Google Finance, budget v2
- Repo può non avere git: salta step commit se assente (o `git init` solo se l’utente lo chiede)
- Spec: `docs/superpowers/specs/2026-08-02-sqlite-investimenti-design.md`

## File map

| Path | Responsibility |
|------|----------------|
| `server/index.ts` | Hono app, listen `:5174`, mount routes |
| `server/db.ts` | Open SQLite, run migrations, typed helpers |
| `server/schema.sql` | DDL all tables |
| `server/routes/state.ts` | GET state, POST merge import, PATCH overrides, migrate/export/import |
| `server/routes/instruments.ts` | CRUD instruments, holdings, contributions, link-tx |
| `server/routes/portfolio.ts` | summary + history |
| `server/routes/quotes.ts` | live + history via adapter |
| `server/routes/settings.ts` | GET/PUT settings (mask api key on GET) |
| `server/lib/portfolioMath.ts` | value, P&L, allocation, history series |
| `server/lib/quotes/yahoo.ts` | Yahoo chart/quote fetch |
| `server/lib/quotes/finnhub.ts` | Finnhub when key present |
| `server/lib/quotes/index.ts` | pick provider + cache read/write |
| `src/lib/appState.ts` | `emptyState`, `withOverrides`, `mergeImport`, override setters (estratti da `db.ts`) |
| `src/api.ts` | fetch `/api/*` client usato da App |
| `src/db.ts` | thin: re-export appState + IndexedDB load solo per migrazione one-shot |
| `src/types.ts` | + `Instrument`, `Holding`, `Contribution`, portfolio DTOs |
| `src/components/Investimenti.tsx` | tab UI |
| `src/components/SettingsModal.tsx` | API key, migrate prompt, export db note |
| `src/App.tsx` | tab Investimenti; load via api |
| `vite.config.ts` | proxy `/api` → `5174` |
| `package.json` | scripts `dev`/`server`/`dev:all`, deps |
| `data/.gitkeep` | dir DB (finance.db gitignored) |
| `.gitignore` | `data/*.db`, `data/*.db-*` |

---

### Task 1: Server scaffold + schema SQLite

**Files:**
- Create: `server/schema.sql`, `server/db.ts`, `server/index.ts`, `data/.gitkeep`
- Modify: `package.json`, `vite.config.ts`, `.gitignore`
- Test: `server/db.test.ts`

**Interfaces:**
- Produces: `openDb(path?: string): Database` — in-memory se `':memory:'`; `migrate(db)` applica `schema.sql`; export `getDb()` singleton su file `data/finance.db`

- [ ] **Step 1: Dipendenze e script**

```bash
npm install better-sqlite3 hono @hono/node-server concurrently
npm install -D @types/better-sqlite3 tsx
```

In `package.json` scripts:

```json
{
  "dev": "concurrently -n web,api -c teal,orange \"vite\" \"tsx watch server/index.ts\"",
  "server": "tsx server/index.ts",
  "dev:web": "vite",
  "build": "tsc --noEmit && vite build",
  "test": "vitest run"
}
```

- [ ] **Step 2: `.gitignore` + `data/.gitkeep`**

Aggiungi:

```
data/*.db
data/*.db-*
```

Crea `data/.gitkeep`.

- [ ] **Step 3: Write failing test — migrate creates tables**

`server/db.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, migrate } from "./db";

describe("sqlite schema", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "fin-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("creates core tables", () => {
    const db = openDb(path.join(dir, "t.db"));
    migrate(db);
    const names = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all()
      .map((r: { name: string }) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "transactions",
        "category_overrides",
        "recurring_marks",
        "internal_overrides",
        "instruments",
        "holdings",
        "contributions",
        "quotes_cache",
        "settings",
      ]),
    );
  });
});
```

- [ ] **Step 4: Run test — expect FAIL (module missing)**

Run: `npm test -- server/db.test.ts`  
Expected: FAIL cannot find module `./db`

- [ ] **Step 5: Implement `server/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  internal INTEGER
);

CREATE TABLE IF NOT EXISTS category_overrides (
  transaction_id TEXT PRIMARY KEY,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_marks (
  transaction_id TEXT PRIMARY KEY,
  mark TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS internal_overrides (
  transaction_id TEXT PRIMARY KEY,
  internal INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS instruments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  ticker TEXT,
  isin TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS holdings (
  instrument_id TEXT PRIMARY KEY REFERENCES instruments(id) ON DELETE CASCADE,
  quantity REAL,
  cash_balance REAL,
  cost_basis REAL NOT NULL DEFAULT 0,
  as_of TEXT
);

CREATE TABLE IF NOT EXISTS contributions (
  id TEXT PRIMARY KEY,
  instrument_id TEXT NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  transaction_id TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS quotes_cache (
  ticker TEXT NOT NULL,
  as_of TEXT NOT NULL,
  open REAL,
  high REAL,
  low REAL,
  close REAL NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (ticker, as_of)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

- [ ] **Step 6: Implement `server/db.ts`**

```ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DEFAULT_DB = path.join(ROOT, "data", "finance.db");

export function openDb(dbPath: string = DEFAULT_DB): Database.Database {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function migrate(db: Database.Database): void {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(sql);
}

let singleton: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!singleton) {
    singleton = openDb();
    migrate(singleton);
  }
  return singleton;
}
```

- [ ] **Step 7: Minimal `server/index.ts` health**

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { getDb } from "./db";

getDb(); // ensure migrate on boot

const app = new Hono();
app.get("/api/health", (c) => c.json({ ok: true }));

const port = Number(process.env.API_PORT ?? 5174);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API http://localhost:${port}`);
});
```

- [ ] **Step 8: Vite proxy**

In `vite.config.ts`:

```ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:5174" },
  },
  test: { globals: true, environment: "node" },
});
```

- [ ] **Step 9: Run tests — PASS**

Run: `npm test -- server/db.test.ts`  
Expected: PASS

- [ ] **Step 10: Smoke API**

Run: `npx tsx server/index.ts` then `curl http://localhost:5174/api/health`  
Expected: `{"ok":true}` — poi stop processo.

- [ ] **Step 11: Commit** (se git presente)

```bash
git add package.json package-lock.json server data/.gitkeep vite.config.ts .gitignore
git commit -m "feat: SQLite server scaffold and schema"
```

---

### Task 2: Estrarre appState + API state (F1 core)

**Files:**
- Create: `src/lib/appState.ts`, `src/api.ts`, `server/routes/state.ts`, `server/lib/stateRepo.ts`
- Modify: `src/db.ts`, `src/App.tsx`, `server/index.ts`
- Test: `src/db.merge.test.ts` (import da `appState`), `server/lib/stateRepo.test.ts`

**Interfaces:**
- Consumes: `openDb` / `getDb`, tipi `AppState` / `Transaction`
- Produces:
  - `loadAppState(db): AppState`
  - `replaceAppState(db, state: AppState): void`
  - `mergeImportIntoDb(db, rows: Transaction[]): { added, updated }`
  - Client: `api.getState(): Promise<AppState>`, `api.mergeTransactions(rows)`, override setters

- [ ] **Step 1: Move pure functions**

Sposta da `src/db.ts` in `src/lib/appState.ts`: `emptyState`, `withOverrides`, `mergeImport`, `setCategoryOverride`, `setInternalOverride`, `setRecurringMark`, e qualsiasi helper export usato dai test.  
`src/db.ts` re-exporta da `appState` + mantiene `loadState`/`saveState` IndexedDB **solo** per migrazione (`KEY = "finance-cashflow-v1"`).

Aggiorna `src/db.merge.test.ts` a importare da `./lib/appState` (o path relativo attuale se re-export).

- [ ] **Step 2: Write failing test — stateRepo roundtrip**

```ts
// server/lib/stateRepo.test.ts
import { describe, it, expect } from "vitest";
import { openDb, migrate } from "../db";
import { loadAppState, replaceAppState, mergeImportIntoDb } from "./stateRepo";

describe("stateRepo", () => {
  it("roundtrips AppState and merges by id", () => {
    const db = openDb(":memory:");
    migrate(db);
    replaceAppState(db, {
      transactions: [
        {
          id: "a1",
          date: "2026-01-01",
          description: "x",
          amount: -10,
          currency: "EUR",
          source: "revolut",
          category: "Altro",
        },
      ],
      categoryOverrides: { a1: "Spesa" },
      recurringMarks: {},
      internalOverrides: {},
    });
    const s = loadAppState(db);
    expect(s.transactions).toHaveLength(1);
    expect(s.categoryOverrides.a1).toBe("Spesa");

    const r = mergeImportIntoDb(db, [
      {
        id: "a1",
        date: "2026-01-02",
        description: "x2",
        amount: -11,
        currency: "EUR",
        source: "revolut",
        category: "Altro",
      },
      {
        id: "b2",
        date: "2026-01-03",
        description: "y",
        amount: 5,
        currency: "EUR",
        source: "mediolanum",
        category: "Entrata",
      },
    ]);
    expect(r.added).toBe(1);
    expect(r.updated).toBe(1);
    expect(loadAppState(db).transactions.find((t) => t.id === "a1")?.amount).toBe(-11);
  });
});
```

- [ ] **Step 3: Run — FAIL missing stateRepo**

Run: `npm test -- server/lib/stateRepo.test.ts`  
Expected: FAIL

- [ ] **Step 4: Implement `server/lib/stateRepo.ts`**

- Map rows ↔ `Transaction` (`internal` INTEGER 0/1/null).  
- `replaceAppState`: transaction clear+insert all tables state.  
- `mergeImportIntoDb`: stessa semantica di `mergeImport` (upsert campi movimento; non cancellare overrides).  
- `setCategoryOverrideDb` / `setInternalOverrideDb` / `setRecurringMarkDb`.

- [ ] **Step 5: Routes + wire**

`server/routes/state.ts`:

- `GET /api/state` → `loadAppState`  
- `POST /api/transactions/merge` body `{ transactions: Transaction[] }` → merge + counts  
- `PUT /api/overrides/category` `{ id, category }`  
- `PUT /api/overrides/internal` `{ id, internal }`  
- `PUT /api/overrides/recurring` `{ key, mark }`  
- `POST /api/migrate` body `AppState` → `replaceAppState` se DB senza transactions **oppure** sempre replace se `force: true`  
- `GET /api/export` → JSON AppState (+ instruments vuoti ok in F1)  
- `POST /api/import` → `replaceAppState`

Monta in `server/index.ts`: `app.route("/api", stateRoutes)`.

- [ ] **Step 6: `src/api.ts`**

```ts
import type { AppState, RecurringMark, Transaction } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const api = {
  getState: () => fetch("/api/state").then((r) => json<AppState>(r)),
  mergeTransactions: (transactions: Transaction[]) =>
    fetch("/api/transactions/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions }),
    }).then((r) => json<{ added: number; updated: number; state: AppState }>(r)),
  setCategory: (id: string, category: string) =>
    fetch("/api/overrides/category", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, category }),
    }).then((r) => json<AppState>(r)),
  setInternal: (id: string, internal: boolean) =>
    fetch("/api/overrides/internal", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, internal }),
    }).then((r) => json<AppState>(r)),
  setRecurring: (key: string, mark: RecurringMark) =>
    fetch("/api/overrides/recurring", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, mark }),
    }).then((r) => json<AppState>(r)),
  migrate: (state: AppState, force = false) =>
    fetch("/api/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...state, force }),
    }).then((r) => json<{ ok: boolean; state: AppState }>(r)),
};
```

- [ ] **Step 7: App usa API**

In `App.tsx`: `loadState` → `api.getState()`; `persist` locale diventa chiamate API che ritornano `AppState` aggiornato.  
On boot: se `api.getState().transactions.length === 0`, prova `loadState()` IndexedDB; se non vuoto, toast/prompt Settings “Migra dati browser → SQLite” che chiama `api.migrate(idbState)`.

- [ ] **Step 8: Tests PASS + manual**

Run: `npm test`  
Run: `npm run dev` — import CSV, ricarica pagina, dati da SQLite.

- [ ] **Step 9: Commit**

```bash
git add src server
git commit -m "feat: persist AppState in SQLite via API"
```

---

### Task 3: Tipi + CRUD instruments / holdings / contributions (F2)

**Files:**
- Modify: `src/types.ts`
- Create: `server/lib/instrumentsRepo.ts`, `server/routes/instruments.ts`, `server/lib/instrumentsRepo.test.ts`
- Modify: `server/index.ts`, `src/api.ts`

**Interfaces:**
- Produces types:

```ts
export type InstrumentType = "pac" | "etf" | "fondo" | "risparmio" | "deposito";

export type Instrument = {
  id: string;
  name: string;
  type: InstrumentType;
  ticker?: string | null;
  isin?: string | null;
  currency: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Holding = {
  instrumentId: string;
  quantity: number | null;
  cashBalance: number | null;
  costBasis: number;
  asOf: string | null;
};

export type Contribution = {
  id: string;
  instrumentId: string;
  date: string;
  amount: number;
  transactionId?: string | null;
  note?: string | null;
};
```

- Repo: `listInstruments`, `upsertInstrument`, `deleteInstrument`, `getHolding`, `upsertHolding`, `listContributions`, `addContribution`, `deleteContribution`, `recalcCostBasis(instrumentId)` (= SUM contributions else keep manual), `linkTransaction(instrumentId, transactionId, amount?, date?)`

- [ ] **Step 1: Write failing tests** — create instrument + contribution updates cost_basis

```ts
it("recalcs cost_basis from contributions", () => {
  const db = openDb(":memory:");
  migrate(db);
  const id = "inst1";
  upsertInstrument(db, {
    id,
    name: "VWCE",
    type: "etf",
    ticker: "VWCE.DE",
    isin: null,
    currency: "EUR",
    notes: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  });
  upsertHolding(db, {
    instrumentId: id,
    quantity: 10,
    cashBalance: null,
    costBasis: 0,
    asOf: "2026-01-01",
  });
  addContribution(db, {
    id: "c1",
    instrumentId: id,
    date: "2026-01-01",
    amount: 500,
    transactionId: null,
    note: null,
  });
  expect(getHolding(db, id)?.costBasis).toBe(500);
});
```

- [ ] **Step 2: Implement repo + routes**

Routes:

- `GET /api/instruments` → lista + holding nested  
- `POST /api/instruments`  
- `PATCH /api/instruments/:id`  
- `DELETE /api/instruments/:id`  
- `PUT /api/instruments/:id/holding`  
- `GET /api/instruments/:id/contributions`  
- `POST /api/instruments/:id/contributions`  
- `DELETE /api/contributions/:id`  
- `POST /api/instruments/:id/link-transaction` body `{ transactionId }` — crea contribution da amount assoluto del tx (uscita → amount positivo versato)

- [ ] **Step 3: Extend `src/api.ts`** con metodi mirror.

- [ ] **Step 4: Tests PASS**

Run: `npm test -- server/lib/instrumentsRepo.test.ts`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: instruments holdings contributions API"
```

---

### Task 4: Tab Investimenti UI (F2) — senza quote live

**Files:**
- Create: `src/components/Investimenti.tsx`
- Modify: `src/App.tsx`, `src/styles.css` (solo classi necessarie), `src/components/SettingsModal.tsx` (voce migrazione se non già fatta)

**Interfaces:**
- Consumes: `api.listInstruments`, CRUD, `api.getState` per link movimenti `internal === true`
- Produces: tab `investimenti` in nav

- [ ] **Step 1: UI skeleton**

KPI placeholder (patrimonio = sum cash_balance + cost_basis finché no quote; documenta in UI “valore ≈ versato finché manca prezzo”).  
Lista strumenti + form “Aggiungi” (name, type, ticker opz, qty/cash, cost).  
Dettaglio: contributions table + “Registra versamento” + “Collega movimento” (select da tx internal).

- [ ] **Step 2: Wire App tab**

```ts
type Tab = "dashboard" | "movimenti" | "abbonamenti" | "paypal" | "consigli" | "investimenti";
// nav label: "Investimenti"
```

- [ ] **Step 3: Manual check**

`npm run dev` — crea PAC risparmio senza ticker, versamento, ricarica, persiste.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: tab Investimenti hybrid CRUD"
```

---

### Task 5: portfolioMath + summary API (F2/F3 bridge)

**Files:**
- Create: `server/lib/portfolioMath.ts`, `server/lib/portfolioMath.test.ts`, `server/routes/portfolio.ts`
- Modify: `server/index.ts`, `src/api.ts`, `src/components/Investimenti.tsx`

**Interfaces:**

```ts
export type PortfolioSummary = {
  totalValue: number;
  totalContributed: number;
  pnl: number;
  pnlPct: number | null;
  cashLiquidity: number; // risparmio + deposito cash_balance
  allocation: { type: InstrumentType; value: number; pct: number }[];
  lines: {
    instrumentId: string;
    name: string;
    type: InstrumentType;
    value: number;
    contributed: number;
    pnl: number;
    price: number | null;
  }[];
};

export function instrumentValue(h: Holding, price: number | null): number;
export function buildSummary(
  rows: { instrument: Instrument; holding: Holding; price: number | null }[],
): PortfolioSummary;
```

Regole (dalla spec):

- Con ticker e `quantity`: `quantity * price` se price != null, else fallback `cost_basis`  
- Senza ticker / solo cash: `cash_balance ?? 0`  
- Versato: `cost_basis` (già ricalcolato da contributions)  
- `cashLiquidity`: sum cash dove type in `risparmio|deposito`

- [ ] **Step 1: Failing unit tests** for `instrumentValue` / `buildSummary` (ETF con prezzo, fondo solo cash, allocation %).

- [ ] **Step 2: Implement + `GET /api/portfolio/summary`** — prices da `quotes_cache` last close per ticker (null se assente).

- [ ] **Step 3: Investimenti KPI da summary API**

- [ ] **Step 4: Tests PASS + commit**

```bash
git commit -m "feat: portfolio summary and allocation"
```

---

### Task 6: Quote adapters + cache (F3)

**Files:**
- Create: `server/lib/quotes/yahoo.ts`, `server/lib/quotes/finnhub.ts`, `server/lib/quotes/index.ts`, `server/routes/quotes.ts`, `server/routes/settings.ts`
- Test: `server/lib/quotes/yahoo.test.ts` (mock `fetch`)

**Interfaces:**

```ts
export type QuoteBar = { asOf: string; open: number | null; high: number | null; low: number | null; close: number; source: string };

export async function fetchQuote(ticker: string, apiKey: string | null): Promise<QuoteBar>;
export async function fetchHistory(ticker: string, from: string, to: string, apiKey: string | null): Promise<QuoteBar[]>;
export function getCachedClose(db, ticker: string): number | null;
export function upsertBars(db, ticker: string, bars: QuoteBar[]): void;
```

- Provider: se settings `market_api_key` non vuota → Finnhub; else Yahoo.  
- Yahoo: `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1y` (User-Agent browser).  
- Finnhub: `/quote` + `/stock/candle`.  
- TTL live: se `fetched_at` < 30 min per `as_of=today`, non rifetch.  
- Settings: `GET /api/settings` returns `{ marketProvider, hasApiKey }` (mai la key); `PUT` body `{ marketApiKey?: string, clearApiKey?: boolean }`.

- [ ] **Step 1: Mock-fetch test Yahoo parser** — fixture JSON minimale → bars.

- [ ] **Step 2: Implement adapters + routes**

- `GET /api/quotes/:ticker`  
- `GET /api/quotes/:ticker/history?from&to`  
- `POST /api/quotes/refresh` body `{ tickers?: string[] }` — tutti gli instrument con ticker se omesso

- [ ] **Step 3: Settings UI** — campo API key in `SettingsModal`, salva via API.

- [ ] **Step 4: Manual** — instrument `VWCE.DE` o `IWDA.AS`, refresh, summary mostra price.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: market quotes Yahoo/Finnhub with cache"
```

---

### Task 7: History chart + P&L UI completa (F3)

**Files:**
- Create/modify: `server/lib/portfolioMath.ts` (`buildHistory`), `server/routes/portfolio.ts` (`GET /api/portfolio/history?from&to`)
- Modify: `src/components/Investimenti.tsx` — area chart recharts, allocation chart, dettaglio strumento con price history
- Test: `portfolioMath.test.ts` history con qty fissa × closes

**Interfaces:**

```ts
export function buildHistory(
  lines: { quantity: number | null; cashBalance: number | null; closes: { asOf: string; close: number }[] }[],
  dates: string[],
): { date: string; value: number }[];
```

v1: per ogni date, sum `(quantity ?? 0) * closeOnOrBefore(date)` + `(cashBalance ?? 0)`.

- [ ] **Step 1: Unit test history**

- [ ] **Step 2: API + charts in Investimenti** (stesso `chartTheme` di cashflow se possibile)

- [ ] **Step 3: Dettaglio strumento** — fetch history ticker; se no ticker, messaggio “Nessuna quotazione — aggiorna saldo manuale”

- [ ] **Step 4: `npm test` + `npm run build` PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: portfolio history charts and full investimenti dashboard"
```

---

### Task 8: Docs + cleanup

**Files:**
- Modify: `CLAUDE.md`, `AGENTS.md`, `README.md`
- Mark spec stato: approvato / implementato

- [ ] **Step 1: Aggiorna CLAUDE.md**

- Privacy: locale su disco SQLite + API localhost (non più solo IndexedDB)  
- Stack: + Hono, better-sqlite3  
- Roadmap: v3 parziale (Investimenti F1–F3)  
- Comandi: `npm run dev` avvia web+api  

- [ ] **Step 2: README** — come migrare, path `data/finance.db`, API key opzionale Finnhub

- [ ] **Step 3: Rimuovi dipendenza runtime da IndexedDB salvo migrazione** (`idb-keyval` resta finché serve `loadState` migrate)

- [ ] **Step 4: Commit**

```bash
git commit -m "docs: SQLite investimenti stack and migration"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| SQLite file `data/finance.db` | 1 |
| Mini-server + Vite proxy | 1–2 |
| Migrazione IndexedDB | 2 |
| Schema instruments/holdings/contributions/quotes/settings | 1, 3, 6 |
| Parse client, persist server | 2 |
| Tab Investimenti KPI/allocation/lista/CRUD/link | 4–5, 7 |
| Senza ticker manuale | 4, 7 |
| Yahoo + Finnhub key | 6 |
| History + P&L charts | 5, 7 |
| cost_basis da contributions | 3 |
| Docs CLAUDE | 8 |

**Placeholder scan:** nessuno TBD lasciato.  
**Type consistency:** `Instrument` / `Holding` / `Contribution` / `PortfolioSummary` allineati tra tasks 3–7.

---

## Execution handoff

Piano salvato in `docs/superpowers/plans/2026-08-02-sqlite-investimenti.md`.

**Due opzioni di esecuzione:**

1. **Subagent-Driven (consigliata)** — un subagent fresco per task, review tra i task  
2. **Inline Execution** — eseguo i task in questa sessione con checkpoint  

Quale preferisci?
