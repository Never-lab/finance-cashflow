# Cash Flow

Hub locale per cash flow personale (Mediolanum + Revolut Pocket).

## Avvio

```bash
npm install
npm run dev
```

Apri l’URL di Vite (di solito `http://localhost:5173`).

## Uso

1. **Carica CSV** — export dalla banca.
2. Revolut Pocket: CSV ufficiale (solo righe `COMPLETED`).
3. Mediolanum: CSV con colonne `Data`, `Descrizione`, `Importo` (`;` ok). Se la banca dà solo PDF, converti prima in CSV con quelle colonne.
4. I dati restano nel browser (IndexedDB). Cambia categoria in **Movimenti**.

## Script

- `npm run dev` — sviluppo
- `npm test` — test parser/statistiche
- `npm run build` — build produzione
