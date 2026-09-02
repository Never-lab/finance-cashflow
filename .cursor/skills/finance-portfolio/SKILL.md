---
name: finance-portfolio
description: >
  Analisi portafoglio ITALIA: allocation ETF UCITS, costi, bollo, plusvalenze 26%/12,5%,
  PIR, fondi pensione vs conto titoli, ribilanciamento. Usa per "/finance portfolio",
  "asset allocation", "ribilanciare". Contesto IT. Prima leggi _shared/italy-finance-context.md.
---

# Finance Portfolio — Italia

**Obbligo:** `_shared/italy-finance-context.md`.  
Allinea i dati al **tab Investimenti** di finance-cashflow quando disponibile.

## Dati

- Strumenti: ticker/ISIN, controvalore €, tipo (ETF/fondo/azione/BTP/crypto)  
- Conti: deposito titoli IT, Revolut, fondo pensione (separare previdenza da trading)  
- Profilo: età, orizzonte, rischio, reddito stabile sì/no  
- Costi: TER, commissioni, bollo

## Framework

### Allocation

| Classe | % attuale | Target | Drift |
|--------|-----------|--------|-------|
| Equity globale / USA / EU | | | |
| Emergendi | | | |
| Obbligazioni EUR IG / governativi | | | |
| Monetario / liquidità | | | |
| Immobili / REIT | | | |
| Crypto / altro | | | |

Geografia: non forzare “70% US home bias USA”; per residente IT è normale un mix **globale** (es. VWCE/IWDA-like) + eventuale sleeve EU.

### Bucket fiscali

| Bucket | € | Note |
|--------|---|------|
| Fondo pensione | | deduzioni / tassazione uscita |
| Conto titoli (26% / 12,5%) | | |
| PIR (se presente) | | vincoli |
| Liquidità | | |

### Target per rischio

| Profilo | Equity | Bond/cash |
|---------|--------|-----------|
| Prudente | 30–40% | 60–70% |
| Moderato | 60% | 40% |
| Aggressivo | 80–90% | 10–20% |

Regola età grezza: equity % ≈ 110 − età (adattare).

### Tre fondi (versione IT)

Esempio Boglehead-like UCITS: equity mondo + bond EUR + (opz.) emergenti — ticker a titolo esemplificativo, non raccomandazione prodotto.

## Cosa non fare

- Non suggerire 401k/IRA/HSA placement.  
- Non ignorare **bollo** e fiscalità sostitutiva.  
- Non spingere stock picking se l’utente vuole semplicità (ponytail: pochi ETF + PAC).

## Output — FINANCE-PORTFOLIO.md

Score 1–10, drift vs target, costi annui stimati, 3–5 trade/ribilanciamenti in €,  
separazione chiaro “previdenza” vs “investibile”, disclaimer.
