# Cash Flow Dashboard — Design

**Date:** 2026-08-02  
**Status:** Approved (user: create now, iterate later)

## Goal

Local web app where Nicholas uploads Mediolanum and Revolut Pocket CSV exports and sees cash flow: KPIs, monthly trend, category breakdown, and a filterable transaction list.

## Decisions

| Topic | Choice |
|-------|--------|
| Priority v1 | Cash flow only (not investments/budget) |
| Input | Bank CSV export |
| Banks | Mediolanum + Revolut Pocket |
| Delivery | Vite + React SPA, `npm run dev` → localhost |
| Persistence | IndexedDB in the browser |
| UI language | Italian |
| Out of scope v1 | Budget limits, investment advice, cloud sync, multi-user, Open Banking |

## Architecture

```
CSV upload → bank detector + parser → normalized Transaction[]
         → IndexedDB → Dashboard / Movimenti views
```

Normalized transaction:

```ts
type Transaction = {
  id: string;           // stable hash: source|date|amount|description
  date: string;         // YYYY-MM-DD
  description: string;
  amount: number;       // +income, -expense (EUR)
  currency: string;     // EUR
  source: "mediolanum" | "revolut";
  category: string;     // auto or user override
};
```

Category overrides stored separately keyed by `id`, so re-import keeps user edits. Duplicate import (same `id`) is skipped.

## UI

1. **Dashboard** — period selector; KPI (entrate, uscite, netto, count); monthly chart; category breakdown (expenses); CTA upload  
2. **Movimenti** — table with filters (month, source, search); inline category change  
3. **Upload modal** — file pick, detect/choose bank, 5-row preview, confirm

## Data / parsing

- Detect bank from headers/filename; user can override.  
- Mediolanum: Italian CSV (often `;`, decimal `,`). Map date/description/amount columns by header heuristics.  
- Revolut Pocket: standard Revolut CSV (`Completed Date` / `Description` / `Amount` / `State=COMPLETED`).  
- Auto-categorize with simple keyword rules (IT); unknown → `Altro`.  
- Export backup JSON optional later — not required for v1.

## Errors

- Unreadable CSV → message + keep existing data.  
- Unknown format → ask bank manually; if still fail, show which columns were found.  
- Empty file / no COMPLETED rows → “Nessun movimento importato”.

## Testing

- Unit tests for both parsers (fixture CSV snippets).  
- Unit tests for KPI aggregation and dedup id.  
- Manual: `npm run dev`, upload sample, check charts.

## Success criteria

- `npm install && npm run dev` opens the app.  
- Importing one Mediolanum and one Revolut CSV shows combined KPIs and charts.  
- Refreshing the browser keeps data.  
- Changing a category persists after refresh.
