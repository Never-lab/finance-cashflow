# Agent Skills — assistente finanziario

Skill pack per lavorare su **finance-cashflow** come assistente personale: analisi spese, abbonamenti, budget, obiettivi, patrimonio, FIRE/portfolio.

> Non è consulenza finanziaria professionale. Usa i numeri del tuo SQLite / CSV locali.

## Locale: Italia

Tutte le skill `finance-*` e openaccountant in questo repo sono **adattate all’Italia**.

Contesto obbligatorio: [`.cursor/skills/_shared/italy-finance-context.md`](../.cursor/skills/_shared/italy-finance-context.md)

| Tema | Usa (IT) | Non usare (USA) |
|------|----------|-----------------|
| Reddito | Netto busta / P.IVA forfettario o ordinario | W-2 / 1099 |
| Previdenza | INPS + fondo pensione (deduzione) | Social Security / 401k / Roth |
| Imposte | IRPEF + addizionali; plusvalenze 26%/12,5% | Federal brackets / LTCG 0% |
| Sanità | SSN + fondi/polizze | Medicare / HSA / ACA |
| Investimenti | ETF UCITS, BTP, PIR | Ticker non-UCITS come default |
| Valuta | **€** | $ |

`finance-taxes` è riscritto per IRPEF/fondi pensione/forfettario.  
`finance-retirement`, `finance-emergency`, `finance-portfolio`, `finance-fire`, `finance-quick`, `finance-analyze` sono versioni IT.  
Le altre `finance-*` hanno override IT in testa.

**Stime fiscali = orientative** → CAF / commercialista.

---

## Installazione (già nel repo)

Le skill sono in **`.cursor/skills/`**. Cursor le carica automaticamente aprendo questo progetto.

Lock file: `skills-lock.json` (sorgenti + hash).

Ri-install su macchina nuova (opzionale):

```bash
# dalla root del repo
npx skills add openaccountant/skills -y --agent cursor --copy \
  --skill spending-review subscription-audit monthly-digest smart-categorize \
         cash-flow-forecast financial-goals emergency-fund net-worth \
         lifestyle-creep zero-based-budget expense-optimizer

npx skills add zubair-trabzada/ai-finance-claude -y --agent cursor --copy \
  --skill finance-analyze finance-budget finance-compare finance-debt \
         finance-emergency finance-fire finance-goals finance-networth \
         finance-portfolio finance-quick finance-retirement finance-screen \
         finance-taxes

# consolidare solo in .cursor/skills (evita cartelle agent sparse)
mkdir -p .cursor/skills
rsync -a .agents/skills/ .cursor/skills/
```

## Come usarli (Cursor)

1. Avvia l’app: `npm run dev` (UI `:5173`, API `:5174`) se ti serve consultare i dati live.
2. Esporta o apri i dati: CSV Mediolanum/Revolut, oppure query su `data/finance.db`, oppure backup JSON da Impostazioni.
3. In chat, **invoca la skill per nome** o descrivi l’obiettivo (l’agent seleziona la skill dalla `description`).

Esempi di prompt:

- «Usa **spending-review** sui movimenti di agosto»
- «Fai un **subscription-audit** sul CSV Revolut»
- «**/finance quick** con i totali del mese scorso dal DB»
- «**monthly-digest** di luglio + agosto»

### Dati da passare all’assistente

| Fonte | Come |
|-------|------|
| CSV banca | Carica file in chat o path sotto `fixtures/` / export |
| SQLite | `data/finance.db` (gitignored) — chiedi all’agent di leggere via API o `sqlite3` |
| Backup JSON | Impostazioni → Esporta backup JSON |
| Investimenti | Tab Investimenti / tabelle strumenti nel DB |

---

## Pack 1 — openaccountant (operativo sul cashflow)

Sorgente: [openaccountant/skills](https://github.com/openaccountant/skills)

| Skill | Cosa fa | Quando usarla |
|-------|---------|----------------|
| `spending-review` | Breakdown spese per categoria + trend MoM | Fine mese, “dove vanno i soldi?” |
| `subscription-audit` | Trova ricorrenze / abbonamenti e stima costo annuale | Dopo export Revolut |
| `monthly-digest` | Riepilogo mensile: metriche, trend, anomalie | Rituale fine mese |
| `smart-categorize` | Suggerisce categorie da pattern vendor | CSV nuovi / descrizioni strane |
| `cash-flow-forecast` | Proiezione liquidità da trend | “Ce la faccio a fine mese?” |
| `financial-goals` | Obiettivi con timeline e contributo mensile | Casa, viaggio, cuscinetto |
| `emergency-fund` | Target fondo emergenza da spese fisse | Prima di investire aggressivo |
| `net-worth` | Attivi − passivi nel tempo | Cash + tab Investimenti |
| `lifestyle-creep` | Spesa che cresce con il reddito | Aumento stipendio / bonus |
| `zero-based-budget` | Ogni euro ha una destinazione | Reset budget mensile |
| `expense-optimizer` | Dove tagliare (ricorrenti e one-off) | “Voglio risparmiare X €/mese” |

### Use case openaccountant

1. **Chiusura mese Mediolanum + Revolut**  
   Export CSV → `smart-categorize` → `spending-review` → `monthly-digest`. Salva insight in chat o markdown locale (non commitare PII).

2. **Caccia abbonamenti**  
   Solo Revolut Pocket COMPLETED → `subscription-audit` → lista keep / cancel / could-cancel.

3. **Obiettivo vacanza 3k**  
   `financial-goals` + `cash-flow-forecast` usando media spese dal digest.

4. **Check patrimonio**  
   Saldo conti + strumenti tab Investimenti → `net-worth`.

5. **Dopo aumento**  
   `lifestyle-creep` confrontando 3 mesi pre/post.

---

## Pack 2 — ai-finance-claude (coach / pianificazione)

Sorgente: [zubair-trabzada/ai-finance-claude](https://github.com/zubair-trabzada/ai-finance-claude)

| Skill | Cosa fa | Quando usarla |
|-------|---------|----------------|
| `finance-quick` | Snapshot 60s (savings rate, DTI, top 3 azioni) | Check rapido |
| `finance-analyze` | Analisi multi-area + score salute finanziaria | Review trimestrale |
| `finance-budget` | Budget 50/30/20, zero-based, envelope | Costruire/rivedere budget |
| `finance-debt` | Avalanche vs snowball | Rate / carte |
| `finance-emergency` | Fondo emergenza (dimensione + dove tenerlo) | Affianca `emergency-fund` |
| `finance-goals` | Goal planner multi-obiettivo | Affianca `financial-goals` |
| `finance-networth` | Net worth + milestone | Affianca `net-worth` |
| `finance-portfolio` | Allocation, costi, rebalance | Tab Investimenti |
| `finance-fire` | FI number, Coast/Lean/Fat FIRE | Pianificazione lungo termine |
| `finance-retirement` | Proiezione pensione / nest egg | Orizzonte lungo |
| `finance-compare` | Scenario A vs B (es. rate vs investire) | Decisioni binarie |
| `finance-screen` | Screener strategie (3-fund, dividend, …) | Idee allocation |
| `finance-taxes` | Ottimizzazione fiscale | **US-centric** — adatta a IT |

### Use case ai-finance-claude

1. **Check settimanale 60 secondi**  
   Totale entrate/uscite del mese dal DB → `finance-quick`.

2. **Review investimenti**  
   Export strumenti + allocation attuale → `finance-portfolio` (poi confronta con il tab UI).

3. **Decisione: fondo emergenza vs ETF**  
   `finance-emergency` + `finance-compare`.

4. **Piano FIRE soft**  
   Savings rate da `monthly-digest` → `finance-fire` (numeri indicativi).

5. **Analisi completa**  
   `finance-analyze` con: reddito netto, spese medie 3 mesi, debiti, età, obiettivo.

### Attenzione fiscale

Le skill sono **localizzate Italia** (vedi `_shared/italy-finance-context.md`).  
Non applicare scaglioni IRS / 401k / Roth. Per dichiarativo reale: CAF/commercialista.

---

## Workflow consigliato (stack completo)

```
CSV / DB
   │
   ├─► smart-categorize
   ├─► spending-review ──► monthly-digest
   ├─► subscription-audit / expense-optimizer
   │
   └─► finance-quick ──► (se serve) finance-budget / finance-goals
                              │
                              └─► finance-portfolio / finance-networth
```

Fine mese tipico:

1. Carica CSV in app (o passa file in chat).
2. `spending-review` + `subscription-audit`.
3. `monthly-digest`.
4. Se vuoi un piano: `finance-quick` o `finance-budget`.
5. Opzionale: esportare riepilogo con skill globali `xlsx` / `docx` (già in `~/.cursor/skills`).

---

## Privacy

- Non commitare CSV reali, dump DB, o report con IBAN/nomi.
- `data/*.db` è già in `.gitignore`.
- Preferisci path locali e chat; non pubblicare output delle skill.

## Skill correlate (globali, non in questo repo)

- `finance-dashboard-setup` / `finance-new-month-dashboard` / `finance-customization-dashboard` — flusso HTML CSV-direct (plugin), diverso da questa app SQLite.
- `xlsx` / `docx` — report formattati.
