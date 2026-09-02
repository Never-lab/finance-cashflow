---
name: finance-quick
description: >
  Snapshot 60s salute finanziaria ITALIA: tasso risparmio su netto, copertura emergenza,
  debiti, allineamento pensione. Usa per "/finance quick", "come sto messa/o coi soldi".
  Contesto IT. Prima leggi _shared/italy-finance-context.md.
---

# /finance quick — Snapshot Italia

**Obbligo:** `_shared/italy-finance-context.md`. Una sola risposta, no subagent.

## 6 input (€)

1. Netto mensile (busta / P.IVA)  
2. Spese mensili totali  
3. Liquidità (conti + deposito, no fondi pensione)  
4. Debiti totali (mutuo incluso se vuole panorama; specifica)  
5. Età  
6. Età obiettivo uscita lavoro / pensione

Opzionale: saldo fondo pensione + investimenti per “on-track”.

## Metriche

**Tasso risparmio** = (netto − spese) / netto  

| | |
|--|--|
| ≥20% | Ottimo |
| 10–19% | Ok |
| 5–9% | Debole |
| <5% | Critico |

**Emergenza** = liquidità / spese  

| ≥6 mesi | Ottimo | 3–6 buono | 1–3 debole | <1 critico |

**Debiti:** se c’è mutuo, mostra rata/netto se nota; altrimenti flag “serve dettaglio rate”.  
Soglia attenzione: impegno rate > ~30–35% del netto.

**Pensione (grezzo):** se ha patrimonio investito+fondi, confronta con `(spesa_annua − proxy_INPS) × 25`.  
Se manca INPS: di’ “serve simulazione INPS” e usa solo risparmio/emergenza.

## Output (≤40 righe, italiano)

Scorecard + top 3 azioni concrete (es. “porta fondo pensione a tetto deducibile”, “sposta X € su deposito”, “taglia abbonamenti Y”).  
Valuta in €. Niente benchmark 401k USA.
