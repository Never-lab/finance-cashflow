# Contesto finanziario Italia (finance-cashflow)

**Obbligatorio** per tutte le skill `finance-*` e openaccountant in questo progetto.  
Valuta in **EUR**. Anno di riferimento fiscale: **2026** — verifica sempre limiti/aliquote aggiornate (Agenzia delle Entrate, INPS, MEF) prima di dare numeri definitivi.

**Disclaimer:** solo educazione/informazione. Non è consulenza fiscale, previdenziale o finanziaria. Per decisioni concrete: CAF / commercialista / consulente finanziario indipendente (SCF) / consulente previdenziale.

---

## Mapping US → Italia (non usare termini US)

| USA (evitare) | Italia (usare) |
|---------------|----------------|
| W-2 / paycheck | Dipendente / busta paga / CU |
| 1099 / self-employed | Partita IVA / autonomo / forfettario / ordinario |
| 401(k) / 403(b) | Fondo pensione (aperto/chiuso/PIP) — deduzione art. 10 / contributo datoriale |
| Traditional IRA | (non esiste 1:1) → fondo pensione deducibile |
| Roth IRA | (non esiste) → eventualmente fondo pensione in fase di erogazione / PIR / conto titoli |
| HSA | (non esiste) → spese sanitarie detraibili 19%, fondi sanitari integrativi |
| Social Security | **INPS** (IVS dipendenti), gestione separata, casse professionali |
| Medicare | **SSN** + eventuale assicurazione sanitaria privata / fondi |
| Federal / state tax | **IRPEF** + addizionali regionali/comunali (+ IRES/IRAP se impresa) |
| Standard deduction | Nozioni diverse: no tax area, detrazioni lavoro/famiglia, forfettario |
| Capital gains LTCG brackets | Plusvalenze mobiliari tipicamente **26%** (o 12,5% titoli di Stato IT/UE white list) |
| Estate tax federal | **Imposta di successione/donazione** (franchigie parentela) |
| HYSA / T-bills / I-Bonds | Conto deposito, BOT/BTP, fondi monetari UCITS, libretti |
| 529 | (no) → piano risparmio figli / PAC / eventuale fondo pensione |
| HELOC | Mutuo liquidità / fido / cessione del quinto (contesto diverso) |
| Student loans federal | Prestiti studio / mutui — spesso mercato bancario |
| ACA | SSN + ticket + eventuali polizze |
| Filing MFJ/HoH | Dichiarazione congiunta rara; di solito **individuale** (+ coniuge a carico se spetta) |

---

## IRPEF (orientativo — verificare anno)

Scaglioni IRPEF nazionali (post-riforma recente; **confermare per l’anno in corso**):

| Scaglione imponibile | Aliquota |
|----------------------|----------|
| fino a ~28.000 € | 23% |
| 28.000–50.000 € | 35% |
| oltre 50.000 € | 43% |

Aggiungere sempre stima **addizionale regionale** (tipicamente ~1–3%) e **comunale** (fino a ~0,8–0,9%).

**No tax area / detrazioni lavoro dipendente:** modellare come “imposta netta effettiva” se l’utente dà solo netto in busta.

**Regime forfettario (Partita IVA):** sostitutiva tipicamente **15%** (o **5%** start-up per periodo agevolato) su reddito forfettario (ricavi × coefficiente ATECO), con limiti di ricavi e cause di esclusione — non mescolare con scaglioni IRPEF ordinari.

---

## Contributi previdenziali

| Profilo | Cosa considerare |
|---------|------------------|
| Dipendente | Quota INPS trattenuta + contributo datore (costo azienda ≠ netto) |
| Gestione separata INPS | % su compensi (collaborazioni / alcune P.IVA) |
| Artigiani/commercianti | Fisso + % sul reddito |
| Casse professionali | Aliquote proprie (ordine) |

Età pensione / requisiti: **non inventare**; se manca dato, linkare a [INPS](https://www.inps.it) / simulatore “La mia pensione” e chiedere età obiettivo + anni contributi.

---

## Previdenza complementare (priorità fiscale tipica)

1. Versare al **fondo pensione** fino al tetto di deducibilità annuo (orientativo **~5.164,57 €**/anno — verificare) → risparmio IRPEF marginale.
2. Contributo **datore** (se CCNL / accordo): spesso “soldi gratis”.
3. Oltre tetto: valutare **conto titoli** / ETF UCITS / **PIR** (vincoli e vantaggi da verificare caso per caso).
4. Tassazione prestazioni fondo: spesso sostitutiva agevolata rispetto a IRPEF piena (regole per anzianità iscrizione) — segnalare di verificare con CAF.

Non parlare di “Roth conversion” o “backdoor Roth”.

---

## Investimenti e plusvalenze (persona fisica)

- **Azioni, ETF, fondi, crypto (quadro RW / monitoraggio):** plusvalenze spesso **26%** (sostitutiva) salvo eccezioni.
- **Titoli di Stato italiani / UE white list:** spesso **12,5%**.
- **Interessi conto corrente / deposito:** tipicamente **26%** (bollo proporzionale su giacenze oltre soglie).
- **Imposta di bollo** dossier titoli / prodotti finanziari: considerare nel costo netto.
- **Monitoraggio fiscale / quadro RW:** se asset esteri o intermediario estero — flaggare obbligo dichiarativo, non sostituire il commercialista.
- **PIR** (piani individuali di risparmio): vincoli di detenzione e composizione; non spingere se l’utente vuole massima flessibilità.

Allocation tipica IT: ETF **UCITS** (IE/LU) via broker IT o EU; evitare linguaggio “401k target-date” — usare **PAC**, **lifecycle** fondi IT, o glide path manuale età.

---

## Immobili e costo della vita

- **Prima casa:** IMU spesso esente (salvo lusso); attentioni a secondi immobili.
- **Affitto vs mutuo:** cedolare secca / IRPEF su locazioni se proprietario.
- **Costo vita regionale:** Nord vs Sud / città vs provincia — usarlo in FIRE e emergency (non assumere COL USA).
- **Mutuo:** tasso fisso/variabile BCE; surroga; non “HELOC” come default.

---

## Protezione sociale (invece di Medicare/ACA)

- **SSN** + ticket; eventuali **fondi sanitari** CCNL / polizza privata.
- **INAIL** / infortuni lavoro (dipendenti).
- **Disoccupazione NASPI** (dipendenti che ne hanno diritto) — fattore in sizing emergency fund.
- **Maternità / congedi** CCNL + INPS.
- **Assegno unico** figli (se applicabile) — reddito disponibile.

---

## Successioni e donazioni (cenni)

Franchigie tipiche (verificare): coniuge/figli soglie elevate; altri parenti aliquote/franchigie diverse.  
Non usare exemption estate tax USA ~13M$.

---

## Benchmark “salute finanziaria” in ottica IT

| Metrica | Orientativo |
|---------|-------------|
| Tasso di risparmio su **netto** | ≥20% buono; ≥10% accettabile |
| Fondo emergenza | 3–6 mesi spese essenziali (più se P.IVA / monoreddito) |
| DTI rata/mutuo | attenzione se rata + altri debiti > ~30–35% netto |
| Fondo pensione | almeno matching datore + percorso verso tetto deducibile |
| Liquidità “parcheggio” | conto deposito / monetario UCITS / BOT short — non solo conto corrente a 0% |

Valuta sempre in **€** e, se l’utente dà dati da Mediolanum/Revolut, allinea categorie alle loro (app finance-cashflow).

---

## Output

- Lingua: **italiano** (salvo richiesta inglese).
- File report: stessi nomi (`FINANCE-TAXES.md`, ecc.) ma contenuti IT.
- Ogni stima fiscale: prefisso **“stima orientativa — verificare con CAF/commercialista”**.
- Non citare IRS, Form 8606, RMD 73, FICA, Medicare IRMAA, ecc.
