---
name: finance-analyze
description: >
  Analisi completa salute finanziaria ITALIA (cashflow, debiti, investimenti, pensione,
  protezioni) con score 0–100 e piano 90 giorni. Usa per "/finance analyze",
  "check finanziario completo". Contesto IT. Prima leggi _shared/italy-finance-context.md.
---

# Finance Analyze — Italia

**Obbligo:** `_shared/italy-finance-context.md`.

## Workflow

### Fase 1 — Dati (€, Italia)

Demografia, obiettivi, rischio; reddito netto/lordo e tipo (dipendente/P.IVA);  
spese da cashflow app; liquidità; fondo pensione + conto titoli; immobili;  
mutuo/debiti; protezioni (NASPI potenziale, polizze, fondo emergenza).

Chiedi **regione** (addizionali), non “US state”.

### Fase 2 — Cinque lenti (in parallelo se l’ambiente lo consente)

1. **Cashflow** → spending-review / monthly-digest logic  
2. **Debiti** → finance-debt (rate/netto, avalanche/snowball)  
3. **Investimenti** → finance-portfolio (UCITS, 26%/12,5%)  
4. **Pensione** → finance-retirement (INPS + fondi)  
5. **Protezione** → finance-emergency + lacune assicurative

### Fase 3 — Score 0–100 (pesi suggeriti)

| Area | Peso |
|------|------|
| Risparmio / cashflow | 25 |
| Emergenza | 20 |
| Debiti | 20 |
| Investimenti / previdenza | 20 |
| Protezione | 15 |

Letter grade: A ≥85 … F <50.

### Fase 4 — Piano 90 giorni

Max 7 azioni, ordinate per impatto € e fattibilità (CAF/click banca).

## Output

Report italiano con score, gap principali, piano 90gg, disclaimer.  
Niente 401k/Roth/Social Security.
