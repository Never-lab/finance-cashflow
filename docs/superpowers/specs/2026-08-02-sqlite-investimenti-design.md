# Design: SQLite + tab Investimenti / PAC / Risparmi

**Data:** 2026-08-02  
**Stato:** in revisione utente  
**Progetto:** Finance Cash Flow (`C:\Users\nicho\Documents\Finance`)

## Contesto

L’hub oggi è SPA Vite + React con persistenza **IndexedDB** (`idb-keyval`, chiave `finance-cashflow-v1`). Cash flow v1–v1.5 è fatto. L’utente vuole:

1. Sezione **PAC / investimenti / risparmi** per raggruppare e capire dove sono i soldi  
2. Persistenza su **SQLite** (scelta esplicita vs Postgres)  
3. Dati **ibridi** (movimenti da CSV + anagrafica/saldi manuali)  
4. Dashboard mercato **completa** (storico, allocation %, P&L vs versato)  
5. Prezzi **Yahoo di default** + provider ufficiale opzionale se API key in Settings  

## Decisioni chiuse

| Tema | Scelta |
|------|--------|
| DB | SQLite file locale |
| Architettura | Mini-server Node + API + Vite UI |
| Dati PAC/invest | Ibrido CSV + manuale |
| Mercato UI | Dashboard completa (non solo prezzo) |
| Quote provider | Yahoo default; Finnhub se API key (Twelve come fallback futuro) |

## Obiettivi di successo

- Un file `data/finance.db` contiene cash flow + investimenti; backup = copia file (e/o export JSON).  
- Tab **Investimenti** mostra patrimonio, allocation, P&L, storico, lista strumenti.  
- Fondi senza ticker restano gestibili a saldo manuale.  
- `npm run dev` avvia UI + API; nessun Postgres/Docker.  
- Migrazione one-shot da stato IndexedDB esistente senza perdita override.

## Non-goals (questa release)

- Postgres / multi-utente / cloud sync  
- Electron packaging  
- Trading, ordini, broker API  
- Google Finance (nessuna API ufficiale pubblica)  
- Budget per categoria (v2 roadmap, separato)  
- Scraping aggressivo / realtime tick-by-tick  

## Architettura

```
Browser (Vite :5173)
  └── fetch /api/*  (proxy Vite → server)
        └── Node API (:5174)
              ├── better-sqlite3 → data/finance.db
              └── quote adapters → Yahoo | Finnhub (Twelve opzionale dopo)
```

- UI resta React; `src/db.ts` (IndexedDB) viene sostituito da client HTTP verso `/api`.  
- API key mercato solo su server (tabella `settings` / file locale), mai nel bundle.  
- Script `npm run dev` = concurrently (o equivalente) Vite + server.  
- Produzione locale: `npm run build` + `node server` che serve static + API, oppure due comandi documentati.

### Motivo vs alternative

- **sql.js in browser:** non risolve CORS né secret delle API key.  
- **Postgres:** overkill single-user desktop.  
- **Electron:** packaging deferito.

## Schema SQLite (essenziale)

### `transactions`

Come modello attuale: `id`, `date`, `description`, `amount`, `currency`, `source`, `category`, `internal` (nullable/heuristic).

### Override (tabelle o JSON column — preferenza tabelle)

- `category_overrides (transaction_id, category)`  
- `recurring_marks (transaction_id, mark)`  
- `internal_overrides (transaction_id, internal)`  

### `instruments`

| Colonna | Note |
|---------|------|
| id | uuid/text PK |
| name | es. “VWCE”, “PAC Mediolanum X” |
| type | `pac` \| `etf` \| `fondo` \| `risparmio` \| `deposito` |
| ticker | opzionale (Yahoo symbol) |
| isin | opzionale |
| currency | default EUR |
| notes | testo libero |
| created_at / updated_at | |

### `holdings`

Saldo corrente per strumento:

| Colonna | Note |
|---------|------|
| instrument_id | FK |
| quantity | unità (ETF); nullable se solo cash balance |
| cash_balance | per risparmio/deposito/fondi valorizzati a mano |
| cost_basis | denormalizzato: se esistono `contributions` = SUM(amount), altrimenti valore manuale |
| as_of | data ultimo aggiornamento manuale |

Una riga attiva per strumento (v1); storico valorizzazioni via quote + contributions, non snapshot giornalieri obbligatori. Aggiornare `cost_basis` a ogni insert/delete contribution.

### `contributions`

| Colonna | Note |
|---------|------|
| id | PK |
| instrument_id | FK |
| date | YYYY-MM-DD |
| amount | EUR versato (+) |
| transaction_id | nullable — link a movimento banca |
| note | |

### `quotes_cache`

| Colonna | Note |
|---------|------|
| ticker | |
| as_of | data (giornaliera per storico) |
| open / high / low / close | |
| source | `yahoo` \| `finnhub` \| … |
| fetched_at | TTL live ~15–60 min |

### `settings`

Chiave/valore: `market_provider`, `market_api_key` (solo locale), path/flags migrazione.

## Migrazione da IndexedDB

1. UI/Settings: export JSON già esistente resta supportato.  
2. Al primo avvio API: se `finance.db` vuoto e arriva `POST /api/migrate` con payload AppState (o import file), inserisce transactions + overrides.  
3. Opzionale: al load, se IndexedDB ha dati e SQLite vuoto, prompt “Importa dati browser → SQLite”.  
4. Dopo migrazione ok, IndexedDB può restare in sola lettura/backup o essere svuotato da Settings (esplicito).

## API (bozza)

- `GET/POST /api/transactions`, merge import CSV (logica attuale `mergeImport` sul server)  
- `PATCH` override categoria / internal / recurring  
- `GET/POST/PATCH/DELETE /api/instruments`, `holdings`, `contributions`  
- `POST /api/instruments/:id/link-transaction`  
- `GET /api/portfolio/summary` — patrimonio, versato, P&L, allocation  
- `GET /api/portfolio/history?from&to` — serie valore  
- `GET /api/quotes/:ticker` + `GET /api/quotes/:ticker/history`  
- `GET/PUT /api/settings`  
- `POST /api/migrate`, `GET /api/export`, `POST /api/import`

CSV upload: parse resta in client **oppure** sposta sul server; v1 può tenere parse in client e `POST` transactions normalizzate (meno churn). Preferenza: **parse client, persist server** per riusare parser testati.

## UX — tab Investimenti

Stesso design system (`styles.css` teal/clay). Lingua IT.

1. **KPI** — patrimonio · versato · P&L (€/%) · liquidità risparmi/depositi  
2. **Allocation** — % per `type`  
3. **Andamento** — curva valore portafoglio (recharts)  
4. **Lista strumenti** — nome, tipo, qty/saldo, prezzo, valore, P&L; click → dettaglio (storico + versamenti)  
5. **Azioni** — aggiungi strumento, registra versamento, collega movimento (tra transfer interni)  
6. **Senza ticker** — solo manuale; no chart mercato; P&L = valore manuale − cost_basis se valorizzato  

Settings: API key mercato opzionale, provider, export `.db` / JSON, stato migrazione.

Errori quote: UI usa cache + toast/avviso; non blocca il tab.

## Calcolo P&L e storico (v1)

- **Valore strumento con ticker:** `quantity * last_close` (o cash_balance se impostato e qty assente).  
- **Valore senza ticker:** `cash_balance` manuale.  
- **Versato:** `SUM(contributions.amount)` se > 0, altrimenti `holdings.cost_basis`.  
- **P&L:** valore − versato.  
- **Storico portafoglio (v1):** `quantity_corrente × close[t]` + `cash_balance` (qty non ricostruita nel tempo). Limite accettato; v2: qty da contributions / lotti.

## Fasi di implementazione

| Fase | Deliverable |
|------|-------------|
| **F1** | Server + SQLite schema + CRUD transactions/overrides + migrazione IndexedDB + Vite proxy; UI legge/scrive API |
| **F2** | Tab Investimenti: instruments/holdings/contributions, KPI, allocation, link movimenti interni |
| **F3** | Quote Yahoo + cache; Settings API key; storico, P&L, grafici dashboard completa |

Ordine obbligato: F1 → F2 → F3.

## Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Yahoo non ufficiale / breakage | Adapter + provider ufficiale opzionale; cache |
| Fondi Mediolanum senza prezzo | Tipo `fondo` / saldo manuale |
| Doppia fonte di verità durante migrazione | Prompt one-shot; flag `migrated_at` in settings |
| better-sqlite3 nativo su Windows | Documentare build tools; alternativa `libsql` se serve |

## Testing

- Vitest: schema helpers, merge import server-side, P&L math, quote adapter mock  
- Manuale: migrazione da export JSON reale, refresh quote, strumento senza ticker  

## Aggiornamenti doc progetto

Dopo implementazione: aggiornare `CLAUDE.md` / `AGENTS.md` (privacy non più “solo browser”; stack server + SQLite; roadmap v3 parziale).
