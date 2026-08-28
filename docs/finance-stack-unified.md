# Finance Stack — Architettura unificata (Nicholas)

Documento di riferimento unico: **realtà finanziaria** ↔ **metafora SysAdmin** ↔ **app Cash Flow**.
Aggiornato: 2026-08-28.

---

## 0. Stato del sistema

| Metrica | Valore |
|---------|--------|
| Stabilità | **Stable release** — bug liquidità risolti, anxiety daemon off |
| Deploy app | Railway `finance-cashflow` (API + UI); auth **in corso** (F-deploy) |
| Fonte dati | CSV Mediolanum + Revolut → SQLite `/data/finance.db` (cloud) o locale |
| Prossimo obiettivo | **Next Level**: rendimento idle cash, accelerazione Casa, telemetria unificata |

---

## 1. Topologia di rete (Hybrid Cloud / DMZ)

```
                    ┌─────────────────────────────────────┐
                    │  NODO 1: Mediolanum                 │
                    │  Mainframe / Cold Storage           │
                    │  ─────────────────────────────────  │
                    │  • INBOUND stipendio (~1.750–1.785 €)│
                    │  • Cronjob passivi (SDD, PAC, DR)    │
                    │  • Fondo Emergenza ufficiale        │
                    │  • NO spesa quotidiana              │
                    └──────────────┬──────────────────────┘
                                   │ DATA PUSH mensile
                                   │ ~1.220–1.255 € netti
                                   ▼
                    ┌─────────────────────────────────────┐
                    │  NODO 2: Revolut                    │
                    │  Edge Server / Hot Wallet           │
                    │  ─────────────────────────────────  │
                    │  • Free RAM (vita quotidiana)       │
                    │  • Vault / Pocket (risparmio)       │
                    │  • Waterfall routing surplus        │
                    └─────────────────────────────────────┘

     ┌──────────────────┐         ┌──────────────────────────┐
     │ Air-Gapped Backup│         │ Cash Flow (monitoring)   │
     │ Fondo segreto    │         │ CSV → KPI → Consigli     │
     │ offline, non in  │         │ Investimenti · Budget v2 │
     │ CSV / app        │         └──────────────────────────┘
     └──────────────────┘
```

**Regola DMZ:** Mediolanum = silenzioso e protetto. Revolut = unica interfaccia operativa giornaliera.

---

## 2. Variabili di sistema (log mensili)

### INBOUND (Mediolanum)

| Voce | €/mese |
|------|--------|
| Stipendio netto | **~1.750 – 1.785** |

### OUTBOUND FISSI (cronjob su Mainframe, ~530 €/mese)

| Cronjob | €/mese | Traccia in app |
|---------|--------|----------------|
| PAC Morgan Stanley | 150 | Investimenti + movimento Mediolanum |
| Fondo Emergenza ufficiale | 150 | Investimenti / risparmio Mediolanum |
| Prestito | 110 | Categoria + Impegni |
| Utenze / SDD | ~120 | Abbonamenti / ricorrenti |

### DATA PUSH → Revolut

| Voce | €/mese |
|------|--------|
| Residuo dopo cronjob mainframe | **~1.220 – 1.255** |
| Uso | Free RAM + Vault Pocket |

### Patch attive (ottimizzazione RAM)

| Patch | Effetto |
|-------|---------|
| **Buoni pasto v2.0** | Spesa grossa 70–80% containerizzata; batch cooking; cibo ≈ **0 impact** su Free RAM |
| **Waterfall routing** | Surplus Revolut a cascata: scadenze brevi → Vault Auto → Vault Casa → long-term |

---

## 3. Nodi di storage (Vault & backup)

| Nodo | Metafora | Target | Deadline / note |
|------|----------|--------|-----------------|
| Fondo Emergenza (Mediolanum) | Disaster Recovery ufficiale | policy personale | Cronjob silente · IBAN deposito `IT02J0306234210000060114212` |
| **Air-Gapped Backup** | Offline, non in CSV | riserva critica | Drain solo per incidenti major (es. auto 2,5k) |
| **Vault Auto** (Revolut Pocket) | Hot storage assicurazione | **2.500 €** | **Nov 2026** — ~750 € ancora necessari |
| **Vault Casa** (Revolut Pocket) | Bare Metal / mutuo futuro | **10.000 €** | Sandbox: stress test **380 €/mese** (rata simulata) |

### Waterfall routing (priorità code)

```
Surplus Revolut
    │
    ├─► P0 (fino Nov 2026): Vault Auto  ← hard deadline assicurazione
    │
    ├─► P1: scadenze brevi (vacanze, impegni PayPal rate)
    │
    ├─► P2 (da Dic 2026): Vault Casa     ← mutuo prep
    │
    └─► P3: Tier rendimento (ETF monetari / deposito) — CDN capitale
```

---

## 4. I tre percorsi di upgrade (unificati)

Non sono alternative esclusive: formano **un unico release train** con fasi.

### Percorso A — CDN del capitale (liquidità idle → rendimento)

**Obiettivo:** euro sopra il buffer generano rendimento ≥ inflazione senza toccare MTTR emergenze.

| Tier | Dove | Quanto tenere | Strumento |
|------|------|---------------|-----------|
| T0 RAM | Revolut Attuale | 1–1,5 mesi spesa edge (~800–1.000 €) | non investire |
| T1 Cache | Revolut / broker | eccedenza post-waterfall | ETF monetari, deposito, fondi liquidi |
| T2 Cold | Mediolanum | già in PAC / emergenza | audit allocation 1×/anno |

**In app:** tab **Investimenti** (già live) — registrare PAC MS, fondi, depositi; quote Yahoo.

### Percorso B — Pipeline IaC Casa Bare Metal

**Obiettivo:** 10.000 € Vault Casa senza swap sulla RAM operativa.

| Fase | Azione |
|------|--------|
| Now → Nov 2026 | P0 = Vault Auto (~750 € missing) |
| Dic 2026+ | P0 = Vault Casa; mantieni 380 €/mese come “rata ghost” |
| Surplus post-patch cibo | Stima +150–300 €/m → bind fisso a Vault Casa (timer mensile) |

**In app:** v2 **Obiettivi/Vault** (da costruire) o budget dedicati per categoria Pocket.

### Percorso C — Observability & policy engine

**Obiettivo:** single pane of glass; zero surprise outbound; patrimonio in una curva.

| Layer | Strumento | Stato app |
|-------|-----------|-----------|
| Ingest | CSV Mediolanum + Revolut | ✅ |
| KPI / Sankey / heatmap | Dashboard | ✅ |
| Impegni / PayPal / ricorrenti | Tab dedicate | ✅ |
| SIEM finanziario | Tab Consigli | ✅ |
| Alert budget | **v2 Budget per categoria** | ⬜ |
| Deploy remoto | Railway + auth | 🔄 in corso |
| Obiettivi Vault | **v4 Obiettivi** | ⬜ |

**Cadence:** review mensile (stesso giorno del reload CSV) — 15 min post-mortem.

---

## 5. Disaster playbook (ordine di drain)

In caso di **incidente finanziario** (spesa imprevista):

1. **Air-Gapped Backup** (se sufficiente — non toccare RAM)
2. Vault Auto — solo se sopra minimo post-Nov
3. Tier T1 liquido (Investimenti vendibili T+0/T+1)
4. Free RAM Revolut
5. **Mai** in ordine inverso senza esplicita decisione

---

## 6. Mappa app Cash Flow ↔ stack reale

| Concetto reale | Tab / feature | CSV source |
|----------------|---------------|------------|
| Spesa edge / Free RAM | Dashboard KPI (Revolut, no interni) | Revolut |
| Cronjob mainframe | Movimenti filtrati Mediolanum | Mediolanum |
| Ricorrenti / SDD | Abbonamenti | entrambi |
| Rate PayPal | PayPal | Mediolanum (addebiti) |
| PAC / ETF / fondi | Investimenti | Mediolanum |
| Pocket Vault Auto/Casa | Investimenti tipo `risparmio` + descrizione Pocket | Revolut |
| Leak / anomalie | Consigli | derivato |
| Budget vs speso | **v2** | derivato |
| Target Vault progress | **v4 Obiettivi** | manuale + saldi |

**Trasferimenti interni** (push Mediolanum→Revolut, Pocket↔Attuale): marcare **internal** — esclusi da KPI cash flow, netto coerente.

---

## 7. Roadmap prodotto (release train)

| Release | Scope | Percorso | Priorità |
|---------|--------|----------|----------|
| **F-deploy** | Auth, Railway prod, volume SQLite | C | 🔴 now |
| **F-deploy.2** | Passkey / impronta (WebAuthn) | C | dopo auth |
| **v2** | Budget mensile per categoria + alert 80/100% | C | 🔴 dopo deploy |
| **v3.1** | Tier investimenti (T0/T1/T2) in Investimenti | A | 🟡 |
| **v4** | Obiettivi Vault (Auto, Casa) + waterfall visuale | B | 🟡 |
| **v4.1** | Curva patrimonio totale (liquido + investito + vault) | C | 🟢 |

Ordine consigliato di implementazione:

1. **F-deploy** — chiudi la DMZ pubblica (auth)
2. **v2 Budget** — policy engine minimo
3. **v4 Obiettivi Vault** — P0 Auto fino Nov, poi Casa
4. **v3.1 Tier rendimento** — CDN capitale
5. Passkey + curva patrimonio totale

---

## 8. KPI di sistema (SLO mensili)

| KPI | Target | Dove leggerlo |
|-----|--------|----------------|
| Free RAM Revolut (fine mese) | ≥ 0, ideally +buffer | Dashboard netto periodo |
| Vault Auto | 2.500 € entro Nov 2026 | Obiettivi v4 / Pocket manuale |
| Vault Casa | +380 €/mese (sandbox) | Obiettivi v4 |
| Outbound fissi mainframe | ~530 € ±5% | Mediolanum filtrato |
| Spesa cibo edge | ≈ 0 net (patch buoni pasto) | Categoria Cibo Revolut |
| Impegni totali | PayPal rate + ricorrenti | Dashboard Impegni |
| Score Consigli | trend ↑ nel tempo | Tab Consigli |

---

## 9. Operazioni ricorrenti (runbook)

| Cronjob | Frequenza | Azione |
|---------|-----------|--------|
| CSV export Mediolanum | mensile | Import app |
| CSV export Revolut | mensile | Import app |
| Review Consigli + budget | mensile | 15 min, stesso giorno |
| Audit PAC allocation | annuale | Investimenti tab |
| Backup DB | mensile | Settings JSON o copia `finance.db` |
| Waterfall priority check | Nov 2026 | Switch P0 Auto → Casa |

---

## 10. Glossario metafora ↔ finanza

| SysAdmin | Finanza |
|----------|---------|
| Mainframe / Cold Storage | Mediolanum (stipendio, fissi, DR) |
| Edge / Hot Wallet | Revolut Attuale |
| Vault / Pocket | Risparmi Revolut dedicati |
| Data Push | Bonifico mensile verso Revolut |
| Free RAM | Liquidità disponibile per vivere |
| Cronjob | SDD / PAC / addebiti automatici |
| Air-Gapped | Fondo segreto offline |
| Waterfall routing | Priorità allocazione surplus |
| Patch | Ottimizzazione comportamentale (buoni pasto) |
| CDN capitale | Investire liquidità idle |
| Observability | Cash Flow dashboard + Consigli |
| Policy engine | Budget v2 + obiettivi Vault |
| DMZ | Separazione spesa (Revolut) vs risparmio (Mainframe) |

---

*Questo documento è la source of truth per decisioni prodotto e CFO. Per implementazione agent: `CLAUDE.md` + questo file.*
