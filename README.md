# Cash Flow

Hub locale per cash flow personale (Mediolanum + Revolut Pocket) e portafoglio investimenti/risparmi.

## Avvio

```bash
npm install
npm run dev
```

Apri `http://localhost:5173`. Vite fa proxy di `/api` verso l’API Node su `http://localhost:5174`.

Solo API: `npm run server`. Solo UI: `npm run dev:web` (con API già in esecuzione).

## Dove stanno i dati

Tutto in **`data/finance.db`** (SQLite, gitignored). Backup:

- copia il file `data/finance.db`, oppure
- **Impostazioni → Esporta backup JSON** (cash flow + override; strumenti investimenti restano nel DB)

## Migrazione da IndexedDB (versioni precedenti)

Se avevi già usato l’app quando i dati erano solo nel browser:

1. Avvia `npm run dev` (serve API + UI).
2. Se SQLite è vuoto ma IndexedDB ha movimenti, compare un banner **Importa nel database locale** — conferma per migrare.
3. In alternativa: **Impostazioni → Importa backup JSON** (sostituisce lo stato via `POST /api/migrate`).

Dopo la migrazione i dati vivono in SQLite; IndexedDB non è più la fonte di verità.

## Uso

1. **Carica CSV** — export dalla banca (parse in browser, persistenza su server).
2. Revolut Pocket: CSV ufficiale (solo righe `COMPLETED`).
3. Mediolanum: CSV con colonne `Data`, `Descrizione`, `Importo` (`;` ok).
4. Tab **Investimenti** — strumenti, versamenti, KPI, allocation, P&L; ticker opzionale (Yahoo); fondi senza ticker a saldo manuale.
5. **Impostazioni** — backup/restore JSON, svuota dati, chiave API mercato opzionale.

## Assistente finanziario (Cursor skills)

In `.cursor/skills/`: pack **openaccountant** (spese, abbonamenti, digest, goal, net worth…) + **ai-finance-claude** (budget, portfolio, FIRE, compare…).

Guida, prompt e use case: **[docs/skills-finance-assistant.md](docs/skills-finance-assistant.md)**.

### Quotazioni (Finnhub opzionale)

Default: **Yahoo Finance**, nessuna chiave.

Per provider ufficiale: in **Impostazioni → Quotazioni di mercato** inserisci una [Finnhub API key](https://finnhub.io/). La chiave resta solo nel DB locale (`settings`), mai nel bundle frontend. Rimuovendo la chiave si torna a Yahoo.

## Script

- `npm run dev` — UI + API (concurrently)
- `npm run server` — solo API
- `npm run dev:web` — solo Vite
- `npm test` — test parser/statistiche/server
- `npm run build` — build produzione UI
- `npm start` — API Node (Railway / produzione; UI static in arrivo con F-deploy)

## Deploy (Railway)

Progetto **separato** da liquidazi. Piano Hobby: un servizio + volume SQLite su `/data`.

### Checklist dashboard (una tantum)

1. [Railway](https://railway.com) → **New Project** → **Deploy from GitHub repo** → `Never-lab/finance-cashflow`, branch **`master`**, autodeploy **ON** (opzionale: Wait for CI).
2. Servizio web → **Settings** → **Generate Domain** (URL `*.up.railway.app`).
3. **Add Volume** → mount path **`/data`** (collegato al servizio).
4. **Variables** (environment production):

   | Variable | Valore |
   |----------|--------|
   | `NODE_ENV` | `production` |
   | `FINANCE_AUTH` | `on` |
   | `FINANCE_USERNAME` | il tuo username |
   | `FINANCE_PASSWORD` | password ≥ 8 caratteri |
   | `FINANCE_SECRET` | stringa random 32+ byte (`openssl rand -hex 32`) |
   | `DATABASE_PATH` | `/data/finance.db` |

   Al primo boot con DB vuoto, l'utente viene creato da `FINANCE_USERNAME` / `FINANCE_PASSWORD`. Nessuna registrazione pubblica.

5. Health: `GET https://<tuo-dominio>/api/health` → `{ "ok": true, … }` (**senza `:8080`** — Railway espone solo HTTPS sulla porta 443).
6. Apri `https://<tuo-dominio>/` per la UI (dopo build con `dist/`).

Build/install: `nixpacks.toml` (Node 22, Python + gcc for `better-sqlite3`, `npm ci`, `npm run build`). Node **22** via `NIXPACKS_NODE_VERSION`.

### Stato attuale

- **Fatto:** config Railway, CI, health API, UI static, **auth login + sessioni HMAC**.
- **Prossimo:** passkey fase 2, v2 budget, v4 obiettivi Vault.
