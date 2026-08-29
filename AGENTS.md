# AGENTS.md

Questo è il progetto **Finance / Cash Flow**.

Prima di lavorare, leggi **`CLAUDE.md`** in root: struttura, stack (Vite + Hono + SQLite `data/finance.db`), formati CSV (Mediolanum/Revolut), tab Investimenti, migrazione IndexedDB, stile UI, comandi, roadmap e skill da usare / evitare.

**Workflow agent:** leggi **`ACTION.md`** — se Nicholas dice **«procedi»** (o «vai» / «commit e push») dopo un task, fai **commit + push** su `master` (Railway autodeploy).

**Tone:** PR/issue English → skill **`no-ai-slop`**. Mai `Co-authored-by: Cursor`. Niente specs/plans MD di default.

**Avvio:** `npm run dev` avvia UI (`:5173`) e API (`:5174`) insieme. I dati persistono in SQLite locale, non in IndexedDB (salvo migrazione one-shot da installazioni precedenti).
