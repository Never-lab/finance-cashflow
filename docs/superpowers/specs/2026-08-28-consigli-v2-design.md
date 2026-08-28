# Consigli v1.6 — Design

**Date:** 2026-08-28  
**Status:** Approved (user: procedi 2026-08-28)  
**Scope:** Revisione completa tab Consigli (fix calcoli + insight nuovi + UI)

## Goal

Rendere la tab **Consigli** affidabile, allineata al resto dell’app (Dashboard Impegni, Mutui, Investimenti) e più utile operativamente: numeri corretti per periodo, score interpretabile, top azioni chiare, link alle tab giuste.

## Non obiettivi

- Budget per categoria (v2)
- Obiettivi Vault / waterfall (v4)
- Score persistito in SQLite o storico oltre 6 mesi calcolato al volo
- AI esterna o consulenza finanziaria reale
- Soglie configurabili in Settings (fisse nel codice, documentate qui)

---

## Problemi da risolvere (baseline)

| # | Problema | Fix |
|---|----------|-----|
| P1 | Ricorrenti €/mese confrontati con entrate **totali** del dataset | Normalizzare su **entrate medie mensili** nel periodo selezionato |
| P2 | Impegni = PayPal + ricorrenti; **mutui assenti** | Allineare a `buildLoanSummary` + `mergeLoanTargets` come Dashboard |
| P3 | Spike “mese corrente” vs resto storico mentre KPI usano tutto | Anomalie calcolate **nel periodo** scelto |
| P4 | Nessun selettore periodo | Chips `month \| 3m \| all` (default **`3m`**) |
| P5 | Score opaco, poche voci positive | Penalità capped per famiglia + bonus risparmio; trend vs mese precedente |
| P6 | Nessun legame Investimenti / Mutui | Insight patrimonio + link UI |
| P7 | Test insufficienti | Suite advisor ampliata su periodo, mutui, score |

---

## Modello dati & periodo

### Input `analyzeFinances`

```ts
analyzeFinances(txns, {
  recurringMarks,
  loanTargets,       // NEW — come Dashboard
  period,            // NEW — default "3m"
  portfolio?,        // NEW — optional { totalContributed, totalValue, pnl, lines[] }
  now?,
})
```

### Flusso

1. `filterByPeriod(txns, period)` → `forCashflow()` (esclude interni)
2. KPI periodo: `computeKpis(filtered)`
3. **Entrate mensili medie:** `avgMonthlyIncome = sum(monthlySeries.income) / monthCount` (min 1)
4. **Savings rate periodo:** `net / income` (come oggi ma sul filtro, non su tutto il DB)
5. Impegni: stessa formula Dashboard (`buildPaypalSummary`, `buildLoanSummary`, `findRecurring` + marks)
6. Anomalie spike: ultimo mese **dentro il periodo** vs media mesi precedenti **nello stesso periodo**

### Periodo UI

- Selector in tab Consigli (stesso stile Dashboard)
- Default **`3m`** — più stabile di “questo mese” per consigli
- Stato periodo **locale alla tab** (non sincronizzato con Dashboard) per evitare sorprese cross-tab

---

## Impegni (allineamento Dashboard)

```ts
impegni = {
  paypalDebt,        // stock — debito residuo piani attivi
  loanDebt,          // stock — residuo banca (Selfycredit + Avvera)
  loanMonthly,       // flusso — rate medie/mese
  recurringMonthly,  // flusso — abbonamenti subscription-like
}
```

### Regole cash flow (flusso mensile)

| ID | Condizione | Severità |
|----|------------|----------|
| `commitments-monthly-high` | `(recurringMonthly + loanMonthly) / avgMonthlyIncome > 0.35` | leak |
| `loan-burden-high` | `loanMonthly / avgMonthlyIncome > 0.20` | warn |

### Regole stock (debito residuo)

| ID | Condizione | Severità |
|----|------------|----------|
| `debt-stock-high` | `(paypalDebt + loanDebt) > avgMonthlyIncome * 6` | warn |
| `paypal-debt` | `paypalDebt > 100` (invariato, soglia assoluta) | warn |
| `loan-residual` | `loanDebt > 5000` | info — “Apri Mutui per dettaglio residuo” |

**Nota:** non sommare stock + flusso in un unico “impegni €” (errore attuale). UI hero mostra **Impegni/mese** = `recurringMonthly + loanMonthly` (+ nota PayPal residuo se > 0).

---

## Insight catalog (completo)

### Ricorrenti (invariato concettualmente, soglie fix)

| ID | Condizione | Sev |
|----|------------|-----|
| `recurring-heavy` | `recurringMonthly / avgMonthlyIncome > 0.25` | leak |
| `recurring-moderate` | `> 0.15` | warn |
| `could-cancel` | marks `could_cancel` | info |
| `review-subs` | ≥2 subscription-like ≥20€ non marcati | warn |

### Anomalie (periodo-aware)

| ID | Condizione | Sev |
|----|------------|-----|
| `spike-{cat}` | ultimo mese nel periodo: cat > 1.75× media altri mesi del periodo; hist ≥30€ | warn |
| `uncategorized` | Altro > 25% spese periodo e > 50€ | warn |
| `cash-heavy` | prelievi periodo > 400€ e > 12% entrate periodo | leak |
| `large-hit` | uscita singola > 15% spese periodo e > 150€ | info |

### Cash flow

| ID | Condizione | Sev |
|----|------------|-----|
| `savings-low` | savings rate < 5% | leak |
| `savings-mid` | < 15% | warn |
| `savings-ok` | ≥ 20% | info (+ bonus score) |
| `red-months` | ≥2 mesi netto negativo nel periodo | warn |
| `thin-data` | < 15 movimenti nel periodo | info |

### Patrimonio (NEW — se `portfolio` disponibile)

| ID | Condizione | Sev |
|----|------------|-----|
| `invest-low-savings` | `totalContributed > 0` AND savings rate < 10% | warn — “PAC attivo ma margine stretto” |
| `invest-on-track` | `totalContributed > 0` AND savings rate ≥ 15% | info — “Risparmio + investimenti in equilibrio” |
| `invest-pnl-down` | `pnl < -totalContributed * 0.10` AND `totalValue > 200` | info — “Controvalore sotto costo; orizzonte lungo” |

Portfolio caricato in `Advisor.tsx` via `api.getPortfolioSummary()` (come tab Investimenti). Se API offline, insight patrimonio omessi.

---

## Score v2

### Calcolo

- Base **100**
- Penalità per insight (cap per famiglia per evitare score 0 immediato):

| Famiglia | Cap penalità |
|----------|--------------|
| Ricorrenti | 22 |
| Anomalie | 18 |
| Cash flow | 24 |
| Patrimonio | 6 |

- Bonus: **+4** se `savings-ok`; **+2** se nessun mese rosso nel periodo
- Score finale `clamp(0, 100)`

### Etichette (invariate)

| Score | Label |
|-------|-------|
| ≥ 80 | Solido |
| ≥ 60 | Ok, con attenzione |
| ≥ 40 | Leak probabili |
| < 40 | Pressione alta |

### Trend

- Ricalcolare score per ciascun mese con dati fino a quel mese (ultimi 6 mesi con movimenti)
- Hero: `▲ +5` o `▼ −3` vs mese precedente (solo display, no persistenza)

---

## UI (`Advisor.tsx`)

### Layout

```
┌─ Period chips: Questo mese | 3 mesi | Tutto ─────────────────┐
├─ Hero: Score+trend | Savings rate | Impegni/mese | N insight ─┤
├─ Top 3 azioni (titolo + CTA primaria) ────────────────────────┤
├─ Filtri: Tutti | Ricorrenti | Anomalie | Cash flow | Patrimonio
├─ Lista insight cards (filtrata, max 10) ──────────────────────┤
└─ Nota: regole locali, non consulenza ─────────────────────────┘
```

### CTA per tab

| Insight kind / id | Link |
|-------------------|------|
| recurring | Abbonamenti |
| anomaly | Movimenti |
| cashflow + paypal/commitment/debt | PayPal |
| loan-* | Mutui |
| invest-* | Investimenti |
| red-months, savings | Dashboard (NEW) |

### Hero “Impegni/mese”

`formatEur(recurringMonthly + loanMonthly)` + hint PayPal residuo se > 0.

---

## File toccati

| File | Change |
|------|--------|
| `src/lib/advisor.ts` | Refactor periodo, impegni, score v2, insight patrimonio |
| `src/lib/advisor.test.ts` | +8–10 casi (periodo, mutui, no double-count) |
| `src/components/Advisor.tsx` | Period, filtri, top 3, trend, fetch portfolio, nuovi link |
| `src/App.tsx` | Pass `loanTargets`, `onGoMutui`, `onGoDashboard`, `onGoInvestimenti` |
| `src/styles.css` | `.advisor-top-actions`, filtri chip, trend badge |

Nessuna migrazione SQLite. Nessuna nuova dipendenza.

---

## Testing

- `analyzeFinances` con 6 mesi CSV: recurring burden **non** sottostimato vs 1 mese
- `loanMonthly` incluso in `commitments-monthly-high`
- Period `month` vs `3m` producono insight diversi
- Score trend: 2 mesi sintetici → delta calcolato
- Portfolio opzionale: insight invest solo se `totalContributed > 0`

---

## Approvazione

Dopo OK utente → piano implementazione (`writing-plans`) → codice → test + build.
