# CLAUDE.md — Finance / Cash Flow

Brief di progetto per agenti (Claude / Cursor). Vale su questo workspace.
Le regole parent in `~/.claude/CLAUDE.md` restano attive; qui c’è il contesto specifico.

## Cos’è

Hub personale di **cash flow** (v1): carichi CSV bancari → dashboard locale con KPI, grafici, movimenti categorizzati.

- **Owner:** Nicholas  
- **Path:** `C:\Users\nicho\Documents\Finance`  
- **Architettura finanziaria personale (nod i Mediolanum/Revolut, Vault, waterfall):** [`docs/finance-stack-unified.md`](docs/finance-stack-unified.md)  
- **Lingua UI:** italiano  
- **Privacy:** dati locali su disco (`data/finance.db`) + API Node su localhost (`:5174`). Nessun cloud, nessun multi-utente. IndexedDB resta solo per migrazione one-shot da installazioni precedenti.  
- **Stile UI:** già approvato dall’utente — palette caldo/teal (`styles.css`), brand serif “Cash Flow”, niente tema purple/AI-slop. **Preservare questo look** in evoluzioni UI.

## Obiettivo prodotto (roadmap)

| Fase | Scope | Stato |
|------|--------|--------|
| **v1** | Cash flow: CSV → KPI + andamento mensile + categorie + lista | **Fatta** |
| **v1.1** | Esclusione trasferimenti interni da KPI + tab Abbonamenti/ricorrenti | **Fatta** |
| **v1.2** | Tab PayPal: piani Paga in 3 / Pay Monthly da movimenti banca (no API) | **Fatta** |
| **v1.3** | Mix D: backup/reset, upsert import, internal override, blocco Impegni | **Fatta** |
| **v1.4** | Grafici Getquin-style: Sankey flusso, curva cumulata, barre, breakdown %, heatmap | **Fatta** |
| **v1.5** | Tab Consigli: advisor locale leak/anomalie/cash flow + score | **Fatta** |
| v2 | Budget per categoria + alert | Non iniziata — vedi stack unificato |
| **v3 (parziale)** | Tab **Investimenti**: PAC/ETF/fondi/risparmi, KPI, allocation, P&L, quote Yahoo (+ Finnhub opzionale) | **Fatta** (F1–F3) |
| **F-deploy** | Auth + Railway + volume SQLite | **In corso** |
| v3.1 | Tier rendimento (T0/T1/T2) in Investimenti | Non iniziata |
| v4 | Obiettivi Vault (Auto, Casa) + waterfall visuale | Non iniziata |

Roadmap dettagliata e numeri di sistema: [`docs/finance-stack-unified.md`](docs/finance-stack-unified.md).

Non anticipare release non in tabella senza richiesta esplicita (YAGNI / ponytail).

## Stack

- **Vite 6 + React 19 + TypeScript** — UI (`:5173`, proxy `/api` → server)
- **Hono + @hono/node-server** — API REST locale (`:5174`, env `API_PORT`)
- **better-sqlite3** — SQLite file `data/finance.db`
- **concurrently** — `npm run dev` avvia web + API insieme
- **idb-keyval** — solo lettura IndexedDB legacy (`finance-cashflow-v1`) per migrazione one-shot
- **recharts** — grafici cash flow + investimenti
- **vitest** — test parser/stats/server
- Nessun router SPA, nessun UI kit, nessun Postgres/Docker

### Comandi

```bash
npm install
npm run dev      # Vite :5173 + API :5174 (concurrently)
npm run server   # solo API (se UI già su dev:web)
npm run dev:web  # solo Vite
npm test
npm run build
```

## Struttura

```
Finance/
├── CLAUDE.md                 ← questo file
├── README.md
├── package.json
├── vite.config.ts            ← proxy /api → localhost:5174
├── index.html
├── data/
│   └── finance.db            ← SQLite runtime (gitignored)
├── docs/superpowers/
│   ├── specs/2026-08-02-cashflow-dashboard-design.md
│   ├── specs/2026-08-02-sqlite-investimenti-design.md
│   └── plans/2026-08-02-sqlite-investimenti.md
├── fixtures/                 ← CSV di prova (sample ok in git; export reali NO)
│   ├── mediolanum-sample.csv
│   ├── revolut-sample.csv
│   └── Elenco movimenti*.csv ← gitignored (PII)
├── server/
│   ├── index.ts              ← Hono app, route /api/*
│   ├── db.ts                 ← openDb, migrate, getDb
│   ├── schema.sql
│   ├── routes/               ← state, instruments, portfolio, quotes, settings
│   └── lib/                  ← repos, portfolioMath, quotes (yahoo|finnhub)
└── src/
    ├── main.tsx
    ├── App.tsx               ← tabs incl. Investimenti; boot via API; prompt migrazione IDB
    ├── api.ts                ← client HTTP /api/*
    ├── styles.css            ← design system (non stravolgere)
    ├── types.ts
    ├── db.ts                 ← loadState IndexedDB (migrazione) + re-export appState
    ├── components/
    │   ├── Dashboard.tsx
    │   ├── Transactions.tsx
    │   ├── Investimenti.tsx
    │   ├── SettingsModal.tsx ← backup JSON, Finnhub key, wipe
    │   └── UploadModal.tsx
    └── lib/
        ├── appState.ts       ← mergeImport, overrides, export/import JSON
        ├── csv.ts            ← parse amount/date/table (con skip preamble)
        ├── detectBank.ts
        ├── importCsv.ts
        ├── parseMediolanum.ts
        ├── parseRevolut.ts
        ├── categorize.ts
        ├── stats.ts
        └── *.test.ts
```

## Modello dati

```ts
type Transaction = {
  id: string;          // hash stabile source|date|amount|description grezza
  date: string;        // YYYY-MM-DD
  description: string; // spesso accorciata (merchant C/O)
  amount: number;      // + entrata, − uscita, EUR
  currency: string;
  source: "mediolanum" | "revolut";
  category: string;
};
```

- **Dedup:** stesso `id` → skip in re-import (`mergeImport`).
- **Override categoria / internal / recurring:** tabelle SQLite (+ tabelle override); sopravvivono al re-import.
- **Investimenti:** `instruments`, `holdings`, `contributions`, `quotes_cache`, `settings` — CRUD via `/api/instruments`, summary/history via `/api/portfolio/*`.
- **Periodi dashboard:** `month` | `3m` | `all`.

## Banche / CSV

### Mediolanum (formato reale — già supportato)

Export tipico: `Elenco movimenti dal … al ….csv`

1. **Preamble** (Nickname, IBAN, saldi, intestazione conto) — da saltare  
2. Header vero: `Operazione;Valuta;Tipologia Operazione;Descrizione;Uscite;Entrate`  
3. Importi tipo `-109.60 €` / `400.00 €` (punto decimale + €)  
4. Descrizioni carta lunghe → `cleanMediolanumDescription` estrae `C/O …`  
5. Detect: filename `elenco movimenti` **oppure** testo con `tipologia operazione` + `uscite` + `entrate`

Parser: `src/lib/parseMediolanum.ts` (`parseCsvTable` con `isHeader`).

### Revolut (IT + EN — già supportato)

Export tipico: `account-statement_YYYY-…_it-it_….csv`

- Header IT: `Tipo,Prodotto,Data di inizio,Data di completamento,Descrizione,Importo,Costo,Valuta,State,Saldo`
- Stato: `COMPLETATO` (IT) o `COMPLETED` (EN) — altri stati esclusi
- Prodotti: `Attuale`, `Risparmi`, `Deposito` — i pocket compaiono in descrizione (`· Risparmi`); i trasferimenti interni gonfiano entrate+uscite ma il **netto** resta coerente
- Detect: filename `account-statement` / `revolut`, oppure colonne `Data di completamento` / `Prodotto`+`Importo`

Parser: `src/lib/parseRevolut.ts`.

### Fixture

- Sample anonimi in `fixtures/*-sample.csv` (ok in repo).  
- Export reali: **mai commitare** (già in `.gitignore`). Per adattare un nuovo formato: metterli in `fixtures/` e dirlo in chat.

## Design decisions (non riaprire senza motivo)

1. Persistenza locale SQLite + mini-server Node (non cloud). Parse CSV resta in client; scritture via API.  
2. Cash flow prima di investimenti (v3 investimenti implementata come tab separata).  
3. Categorie = keyword rules + tipologia Mediolanum; override manuale in UI.  
4. Quote: Yahoo default; Finnhub se API key in Settings (solo server, mai nel bundle).  
5. Stile visuale attuale = reference: teal `#1d4e4a`, clay `#c45c26`, fondo caldo `#f3efe6`.

## Come lavorare qui (agent)

Ordine di default (allineato a FABLE + Superpowers del parent):

1. Leggi questo file + spec/piano in `docs/superpowers/` se tocchi scope.  
2. Feature nuove → brainstorming (una domanda alla volta) → spec → plan → codice.  
3. Fix parser/CSV → TDD sui fixture, poi UI.  
4. Diff piccoli (ponytail). Niente dipendenze nuove se bastano poche righe.  
5. Prima di “fatto”: `npm test` + `npm run build` (e smoke su `npm run dev` se UI — verifica che l’API risponda su `/api/health`).  
6. **Niente commit/push** se non chiesto.  
7. UI: verifica visuale se cambi layout (Playwright MCP ok).  
8. Rispondi in italiano; codice/commenti in inglese.

### Skill utili (già disponibili)

| Skill | Quando |
|-------|--------|
| `/fable` | Checklist sistema agent |
| Superpowers brainstorming / writing-plans | Feature non banali |
| `ponytail` + `karpathy-guidelines` | Implementazione sobria |
| Forge Loop (parent CLAUDE.md) | Auto-critica pre-consegna |
| Playwright MCP | Smoke UI |
| Excel MCP | Solo se serve ispezionare xlsx (v1 è CSV) |

### Skill finance-* in `~/.cursor/skills`

Esistono `finance-dashboard-setup`, `finance-new-month-dashboard`, `finance-customization-dashboard`: sono il flusso **Cowork / HTML artifact / overrides.json**, **non** questa app Vite.  
**Non usarle** su questo repo salvo richiesta esplicita di allineamento o migrazione.

## Cosa serve all’agente (gap / richieste)

Già sufficiente per continuare la v1 e piccole iterazioni.

Utile avere dall’utente **solo quando serve**:

1. **CSV Revolut reale** in `fixtures/` (come fatto per Mediolanum) — se l’export Pocket differisce dal sample.  
2. Per **v2 budget:** limiti mensili desiderati o “parti da media ultimi 3 mesi”.  
3. Opzionale: skill di progetto `finance-cashflow` che punta a questo CLAUDE.md + comandi test — **non obbligatoria**; questo file basta.

Non serve: Open Banking, sync cloud, auth, rewrite React Native.

## Pitfall noti

- Mediolanum: se cambi header o togli preamble, aggiorna `isMediolanumHeader` + test su fixture.  
- **Migrazione IndexedDB:** al boot, se SQLite vuoto e IDB ha dati, banner “Importa nel database locale”; Settings → backup JSON usa `POST /api/migrate`. Dopo migrazione i dati vivono in `data/finance.db`.  
- Backup SQLite: copia `data/finance.db` o export JSON da Settings.  
- API key Finnhub: opzionale in Settings; senza chiave resta Yahoo.  
- Periodo default `month`: fixture di test devono avere date nel mese corrente se si fa smoke “Questo mese”.  
- Chunk recharts grande al build: ok per v1; code-split solo se diventa problema.

## Definition of done (cambio tipico)

- Test verdi sul pezzo toccato  
- Build ok  
- Se parser: almeno un fixture (sample o file utente) importato senza throw  
- Se UI: look coerente con `styles.css` esistente  
- Forge Loop / nota `skipped: X, add when Y` se hai tagliato scope
