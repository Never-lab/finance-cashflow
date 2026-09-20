# Cash Flow

Hub personale di **cash flow** e portafoglio: carichi gli export CSV di banca, li categorizzzi in automatico, e navighi KPI, budget, impegni e investimenti — tutto in locale su SQLite.

Repo: [`Never-lab/finance-cashflow`](https://github.com/Never-lab/finance-cashflow) · workspace tipico: `Documents/Cash`.

## Cosa fa

1. **Import CSV** — Mediolanum (conto/carta) e Revolut Pocket (solo righe completate). Parse nel browser, persistenza sull’API.
2. **Cash flow** — entrate/uscite, categorie, esclusione trasferimenti interni, grafici (Sankey, cumulata, breakdown).
3. **Abbonamenti / ricorrenti** — candidati da storico; stati `could cancel` / `cancelled`.
4. **Piano** — buffer Mediolanum, vault (Auto/Casa…), liquidità, piano liberazione.
5. **Budget** — limiti per categoria sul periodo.
6. **Mutui / PayPal / Buste paga** — da movimenti banca (+ PDF buste dove supportato).
7. **Consigli** — advisor locale (leak, anomalie, score).
8. **Investimenti** — strumenti, versamenti, allocation, P&L; quote Yahoo (Finnhub opzionale).
9. **Backup** — export/import JSON; DB file `data/finance.db`.

Non è un prodotto multi-utente SaaS: un’istanza = i tuoi dati. In produzione (Railway) c’è login locale opzionale.

## Stack (layout)

```
apps/web          React 19 + Vite 6 (UI :5173)
apps/api          Hono + better-sqlite3 (API :5174, serve anche dist/)
packages/shared   tipi + dominio puro (parser, stats, budget, …)
data/             finance.db (gitignored)
fixtures/         CSV sample (export reali gitignored)
```

Alias TypeScript/Vite: `@shared/*` → `packages/shared/*`.

Un solo `package.json` in root (niente workspaces npm): CI e Railway restano `npm ci` → `npm run build` → `npm start`.

## Avvio locale

```bash
npm install
npm run dev
```

Apri `http://localhost:5173`. Vite fa proxy di `/api` → `http://localhost:5174`.

| Comando | Ruolo |
|---------|--------|
| `npm run dev` | UI + API insieme |
| `npm run server` | solo API |
| `npm run dev:web` | solo Vite (API già su) |
| `npm test` | vitest (web + api + shared) |
| `npm run build` | typecheck + bundle UI in `dist/` |
| `npm start` | API produzione (serve anche `dist/` se presente) |

## Dati e privacy

- Fonte di verità: **`data/finance.db`** (SQLite).
- Backup: copia il file, oppure **Impostazioni → Esporta backup JSON**.
- Nessuna chiave mercato nel frontend: Finnhub (se usata) sta in `settings` sul DB.
- Export bancari reali: **non committare** (già in `.gitignore`).

### Migrazione da IndexedDB (app vecchia)

1. `npm run dev`
2. Se SQLite è vuoto ma IndexedDB ha movimenti → banner **Importa nel database locale**
3. Oppure **Impostazioni → Importa backup JSON**

## CSV supportati

- **Revolut Pocket** — CSV ufficiale; solo `COMPLETED` / `COMPLETATO`
- **Mediolanum** — colonne tipo `Data` / `Descrizione` / `Importo` (`;` ok); preamble conto saltato dal parser

Dettaglio formati: `CLAUDE.md` e `packages/shared/lib/parse*.ts`.

## Assistente Cursor

Skill in `.cursor/skills/` (openaccountant + finance IT): spese, abbonamenti, budget, FIRE, tasse IRPEF, ecc.

Guida: [`docs/skills-finance-assistant.md`](docs/skills-finance-assistant.md).

> Non usare le skill globali Cowork `/finance-*-dashboard` su questo repo: qui la UI è Vite + SQLite.

## Deploy (Railway)

Servizio unico + volume SQLite su `/data`. Autodeploy da `master`.

1. New Project → repo `Never-lab/finance-cashflow`, branch `master`
2. Generate Domain
3. Volume mount **`/data`**
4. Variables:

| Variable | Valore |
|----------|--------|
| `NODE_ENV` | `production` |
| `FINANCE_AUTH` | `on` |
| `FINANCE_USERNAME` | username |
| `FINANCE_PASSWORD` | ≥ 8 caratteri |
| `FINANCE_SECRET` | random 32+ byte (`openssl rand -hex 32`) |
| `DATABASE_PATH` | `/data/finance.db` |

Health: `GET /api/health` → `{ "ok": true, … }`.

Build: `nixpacks.toml` (Node 22 + native build per `better-sqlite3`).
