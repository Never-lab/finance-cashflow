---
name: finance-retirement
description: >
  Proiezione pensione ITALIA: INPS, fondi pensione, gap previdenziale, età obiettivo,
  monte risparmi (regola ~4%/25x adattata), sequenza di prelievo. Usa per "/finance retirement",
  "sono in linea per la pensione", "quanto mi serve", "fondo pensione", "INPS".
  Contesto IT. Prima leggi _shared/italy-finance-context.md.
---

# Finance Retirement — Italia

**Obbligo:** `_shared/italy-finance-context.md`.  
**Disclaimer:** informativo. Simulazioni INPS ufficiali restano la fonte per la pensione pubblica.

## Dati

1. Età, età obiettivo uscita lavoro, anni contributi stimati  
2. Netto mensile / lordo annuo  
3. Stima pensione INPS (se ha simulatore) oppure proxy prudente  
4. Fondo pensione: saldo + versamento annuo + matching datore  
5. Altri asset: PAC ETF, BTP, immobili a reddito, TFR in azienda vs fondo  
6. Spesa annua desiderata in pensione (€ oggi)  
7. Mutuo estinto sì/no; coperture sanitarie

## Calcolo gap

```
Fabbisogno annuo da patrimonio ≈ max(0, Spesa_desiderata − Pensione_INPS − Rendite)
Monte necessario ≈ Fabbisogno × 25   (SWR ~4%; usa ×28–33 se FIRE lungo / prudente)
```

Proiezione patrimonio:

```
FV = PV×(1+r)^n + PMT×[((1+r)^n−1)/r]
```

Scenari rendimento reale: 3% / 4% / 5% (prudenti per IT, post-inflazione).

## Allocation per età (orientativa)

| Età | Equity UCITS | Obbligazioni/monetario | Note |
|-----|--------------|------------------------|------|
| <40 | 80–90% | 10–20% | orizzonte lungo |
| 40–55 | 60–75% | 25–40% | |
| 55–65 | 40–60% | 40–60% | riduci sequenza rischio |
| in pensione | 30–50% | resto | + 1–2 anni spese cash |

## Prelievi (IT)

Ordine tipico da valutare (non dogmatico):

1. Conti liquidi / deposito (cuscinetto)  
2. Conto titoli (plusvalenze 26%/12,5% al realizzo)  
3. Prestazioni fondo pensione (regole tassazione agevolata — verificare)  
4. Pensione INPS come base “stabile”

Niente RMD/Social Security claim a 62/70 USA.

## Output — FINANCE-RETIREMENT.md

- Gap € oggi e a data obiettivo  
- Contributo annuo necessario al fondo/PAC  
- Tre scenari (conservativo/base/ottimista)  
- Azioni 90 giorni (es. alzare versamento fondo al tetto deducibile)  
- Disclaimer + “verifica su INPS La mia pensione”
