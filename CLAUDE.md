# CLAUDE.md — Finance / Cash Flow

Brief di progetto per agenti (Claude / Cursor). Vale su questo workspace.
Le regole parent in `~/.claude/CLAUDE.md` restano attive; qui c’è il contesto specifico.

## Cos’è

Hub personale di **cash flow** (v1): carichi CSV bancari → dashboard locale con KPI, grafici, movimenti categorizzati.

- **Owner:** Nicholas  
- **Path:** `C:\Users\nicho\Documents\Finance`  
- **Lingua UI:** italiano  
- **Privacy:** tutto nel browser (IndexedDB). Nessun backend, nessun cloud.  
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
| v2 | Budget per categoria | Non iniziata |
| v3 | Dove mettere i soldi (risparmio / investimenti) | Non iniziata |

Non anticipare v2/v3 senza richiesta esplicita (YAGNI / ponytail).

## Stack

- **Vite 6 + React 19 + TypeScript**
- **idb-keyval** — persistenza IndexedDB (`finance-cashflow-v1`)
- **recharts** — grafici
- **vitest** — test unitari parser/stats
- Nessun router, nessun UI kit, nessun backend

### Comandi

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
```

## Struttura

```
Finance/
├── CLAUDE.md                 ← questo file
├── README.md
├── package.json
├── vite.config.ts
├── index.html
├── docs/superpowers/
│   ├── specs/2026-08-02-cashflow-dashboard-design.md
│   └── plans/2026-08-02-cashflow-dashboard.md
├── fixtures/                 ← CSV di prova (sample ok in git; export reali NO)
│   ├── mediolanum-sample.csv
│   ├── revolut-sample.csv
│   └── Elenco movimenti*.csv ← gitignored (PII)
└── src/
    ├── main.tsx
    ├── App.tsx               ← tabs Dashboard | Movimenti, stato, toast
    ├── styles.css            ← design system (non stravolgere)
    ├── types.ts
    ├── db.ts                 ← load/save, mergeImport, categoryOverrides
    ├── components/
    │   ├── Dashboard.tsx
    │   ├── Transactions.tsx
    │   └── UploadModal.tsx
    └── lib/
        ├── csv.ts            ← parse amount/date/table (con skip preamble)
        ├── detectBank.ts
        ├── importCsv.ts
        ├── parseMediolanum.ts  ← formato reale banca
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
- **Override categoria:** `categoryOverrides[id]` in IndexedDB; sopravvivono al re-import.
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

1. SPA browser-only (non SQLite/server) — scelta utente.  
2. Cash flow prima di investimenti.  
3. Categorie = keyword rules + tipologia Mediolanum; override manuale in UI.  
4. Stile visuale attuale = reference: teal `#1d4e4a`, clay `#c45c26`, fondo caldo `#f3efe6`.

## Come lavorare qui (agent)

Ordine di default (allineato a FABLE + Superpowers del parent):

1. Leggi questo file + spec/piano in `docs/superpowers/` se tocchi scope.  
2. Feature nuove → brainstorming (una domanda alla volta) → spec → plan → codice.  
3. Fix parser/CSV → TDD sui fixture, poi UI.  
4. Diff piccoli (ponytail). Niente dipendenze nuove se bastano poche righe.  
5. Prima di “fatto”: `npm test` + `npm run build` (e smoke su `npm run dev` se UI).  
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
3. Per **v3 investimenti:** orizzonte, rischio, liquidità già da parte (niente consigli regolamentati: solo organizzazione numeri).  
4. Opzionale: skill di progetto `finance-cashflow` che punta a questo CLAUDE.md + comandi test — **non obbligatoria**; questo file basta.

Non serve: Open Banking, sync cloud, auth, rewrite React Native.

## Pitfall noti

- Mediolanum: se cambi header o togli preamble, aggiorna `isMediolanumHeader` + test su fixture.  
- IndexedDB: clear = “Application → Storage” in DevTools; non c’è reset in-app (ancora).  
- Periodo default `month`: fixture di test devono avere date nel mese corrente se si fa smoke “Questo mese”.  
- Chunk recharts grande al build: ok per v1; code-split solo se diventa problema.

## Definition of done (cambio tipico)

- Test verdi sul pezzo toccato  
- Build ok  
- Se parser: almeno un fixture (sample o file utente) importato senza throw  
- Se UI: look coerente con `styles.css` esistente  
- Forge Loop / nota `skipped: X, add when Y` se hai tagliato scope
