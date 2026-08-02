# AGENTS.md

Questo è il progetto **Finance / Cash Flow**.

Prima di lavorare, leggi **`CLAUDE.md`** in root: struttura, stack (Vite + Hono + SQLite `data/finance.db`), formati CSV (Mediolanum/Revolut), tab Investimenti, migrazione IndexedDB, stile UI, comandi, roadmap e skill da usare / evitare.

**Avvio:** `npm run dev` avvia UI (`:5173`) e API (`:5174`) insieme. I dati persistono in SQLite locale, non in IndexedDB (salvo migrazione one-shot da installazioni precedenti).
