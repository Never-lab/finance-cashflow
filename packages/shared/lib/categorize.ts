/**
 * Assegnazione categoria spesa/entrata da descrizione, tipologia banca e testo grezzo.
 *
 * Strategia: (1) regole su tipologia Mediolanum, (2) euristiche fuel/vacation/hospitality,
 * (3) array RULES per merchant regex in ordine di priorità, (4) fallback tipologia e “Altro”.
 * Usata al parse CSV e in `recompute`; override utente in `AppState.categoryOverrides`.
 */
import { isFuelPurchase } from "./fuel";
import { isHospitalityVenue } from "./hospitality";
import { isVacationSpend } from "./vacation";

/**
 * Regole merchant → categoria. Ordine array = priorità: prima match vince.
 * Pattern pensati per descrizioni POS/bonifici italiani ed export Revolut.
 */
const RULES: { category: string; patterns: RegExp[] }[] = [
  // --- Reddito da lavoro ---
  {
    category: "Stipendio",
    patterns: [/stipendio/i, /salary/i, /accredito stipendio/i, /disposizione vs\.?\s*favore/i, /emolumenti/i],
  },
  // --- Versamenti verso broker, crypto, dossier titoli ---
  {
    category: "Investimenti",
    patterns: [
      /gomining/i,
      /coinbase/i,
      /binance/i,
      /kraken/i,
      /versamento.*fondi/i,
      /sottoscrizione.*fond/i,
      /LU\d{10}/i,
      /imposta di bollo dossier titoli/i,
      /dossier titoli/i,
    ],
  },
  // --- Costi bancari, bollo, canoni (non mutuo) ---
  {
    category: "Banca e commissioni",
    patterns: [
      /imposta di bollo/i,
      /commissioni su pagamento/i,
      /commissione/i,
      /canone (carte|conto)/i,
      /spese (operazione|bonifico)/i,
      /bollo/i,
    ],
  },
  // --- Fissi abitativi e debito strutturato ---
  { category: "Affitto", patterns: [/affitto/i, /rent/i, /locazione/i] },
  { category: "Mutuo", patterns: [/mutuo/i, /fin\.\s*vari/i, /pag\.\s*mutuo/i] },
  {
    category: "Finanziamento auto",
    patterns: [/avvera.*payment loan/i, /payment loan.*avvera/i, /prg\.car.*avvera/i],
  },
  // --- Utenze luce/gas/telecom ---
  {
    category: "Bollette",
    patterns: [
      /enel/i,
      /eni\b/i,
      /acea/i,
      /hera/i,
      /a2a\b/i,
      /iren\b/i,
      /bolletta/i,
      /fastweb/i,
      /tim\b/i,
      /vodafone/i,
      /windtre/i,
      /iliad/i,
      /utenza telefonica/i,
      /pagamento utenza/i,
      /\bc-?bill\b/i,
      /poste italiane.*luce/i,
      /poste italiane.*gas/i,
    ],
  },
  // --- Polizze e prem assicurativi ---
  {
    category: "Assicurazioni",
    patterns: [/allianz/i, /assicur/i, /unipol/i, /generali/i, /\baxa\b/i, /reale mutua/i, /linear/i, /zurich/i],
  },
  // --- Servizi digitali ricorrenti (streaming, SaaS, telco subscription) ---
  {
    category: "Abbonamenti",
    patterns: [
      /netflix/i,
      /spotify/i,
      /amazon prime/i,
      /disney/i,
      /youtube.?premium/i,
      /\bsky\b/i,
      /cursor/i,
      /klarna/i,
      /dazn/i,
      /icloud/i,
      /apple\.com\/bill/i,
      /google.?one/i,
      /adobe/i,
      /microsoft 365/i,
      /office 365/i,
      /openai/i,
      /chatgpt/i,
      /playstation.?plus/i,
      /xbox live/i,
      /now tv/i,
      /paramount/i,
      /crunchyroll/i,
      /tidal/i,
      /deezer/i,
      /audible/i,
      /dropbox/i,
      /nordvpn/i,
    ],
  },
  { category: "Interessi", patterns: [/interessi netti/i, /\binterest\b/i] },
  // --- Giroconti, wallet, PayPal, Revolut (non consumo se poi internal) ---
  {
    category: "Trasferimenti",
    patterns: [
      /bonifico/i,
      /giroconto/i,
      /transfer/i,
      /revolut/i,
      /ricarica/i,
      /satispay/i,
      /paypal/i,
      /accredita eur/i,
      /deposito senza vincoli/i,
      /pagamento da /i,
      /^to /i,
      /^dal deposito/i,
      /^per i depositi/i,
    ],
  },
  { category: "Prelievi", patterns: [/prelievo/i, /atm withdrawal/i, /prelevamento/i, /maxiprelievo/i] },
  // --- Viaggi, voli, hotel (merchant dedicati) ---
  {
    category: "Vacanze",
    patterns: [
      /headout/i,
      /booking\.com/i,
      /airbnb/i,
      /ryanair/i,
      /easyjet/i,
      /wizz ?air/i,
      /vueling/i,
      /lufthansa/i,
      /bioparc/i,
      /valencia/i,
      /valenciana/i,
      /hotel/i,
      /albergo/i,
      /hostel/i,
      /club avolta/i,
      /duty free/i,
      /emt valencia/i,
      /casa baldo/i,
      /tasqueta/i,
      /ferrocarrils/i,
      /trenord/i,
      /itabus/i,
      /flixbus/i,
      /blablacar/i,
    ],
  },
  // --- Eventi, cinema, gaming store ---
  {
    category: "Intrattenimento",
    patterns: [
      /cinema/i,
      /multiplex/i,
      /the space/i,
      /eventos/i,
      /ticketone/i,
      /ticketmaster/i,
      /concerto/i,
      /teatro/i,
      /museo/i,
      /aquarium/i,
      /parco divert/i,
      /luna park/i,
      /steam games/i,
      /playstation store/i,
      /nintendo eshop/i,
      /xbox/i,
    ],
  },
  // --- Ristorazione e delivery (sovrapposto a hospitality.ts per casi POS) ---
  {
    category: "Ristoranti",
    patterns: [
      /ristorante/i,
      /trattoria/i,
      /pizzeria/i,
      /mcdonald/i,
      /burger king/i,
      /kfc/i,
      /deliveroo/i,
      /glovo/i,
      /just.?eat/i,
      /uber.?eats/i,
      /caff[eè]/i,
      /gelateria/i,
      /bora bora/i,
      /old wild west|wild west/i,
      /officina 41/i,
      /poscargano|posca dal/i,
      /bar lume/i,
      /\(bar\)/i,
      /five guys/i,
      /autogrill/i,
      /hard rock cafe/i,
      /tasqueta/i,
      /tacos/i,
      /captain candy/i,
      /puray punjabi/i,
      /\bcork\b/i,
      /sushi/i,
      /poke/i,
      /kebab/i,
      /paninoteca/i,
      /rosticceria/i,
    ],
  },
  // --- Supermercati e grocery ---
  {
    category: "Spesa",
    patterns: [
      /essellunga/i,
      /esselunga/i,
      /coop\b/i,
      /conad/i,
      /carrefour/i,
      /lidl/i,
      /aldi/i,
      /supermercato/i,
      /maury/i,
      /super a&o/i,
      /grocery/i,
      /\bdia\b/i,
      /eurospin/i,
      /tigros/i,
      /\biper\b/i,
      /pam\b/i,
      /simply/i,
      /penny/i,
      /md discount/i,
      /frutta/i,
      /verdura/i,
      /panader/i,
      /mercato/i,
    ],
  },
  // --- Mobilità (treni, ride, telepass; carburante anche via isFuelPurchase) ---
  {
    category: "Trasporti",
    patterns: [
      /trenitalia/i,
      /italo/i,
      /uber\b/i,
      /taxi/i,
      /carburante/i,
      /telepass/i,
      /autostrade/i,
      /atm milano/i,
      /atac\b/i,
      /gtt\b/i,
      /atm roma/i,
      /mobike/i,
      /lime\b/i,
      /car sharing/i,
      /enjoy\b/i,
    ],
  },
  // --- Officina, parcheggio, bollo veicolo ---
  {
    category: "Auto e manutenzione",
    patterns: [
      /officina/i,
      /gommista/i,
      /pneumatic/i,
      /revisione auto/i,
      /tagliando/i,
      /autodoc/i,
      /norauto/i,
      /midas\b/i,
      /car wash/i,
      /autolavaggio/i,
      /parcheggio/i,
      /sosta\b/i,
      /ztl/i,
      /bollo auto/i,
      /motorizz/i,
      /manutenzione auto/i,
    ],
  },
  // --- Sanità e farmacia ---
  {
    category: "Salute",
    patterns: [
      /farmacia/i,
      /ospedale/i,
      /medico/i,
      /dental/i,
      /asl\b/i,
      /laboratorio analisi/i,
      /optometr/i,
      /occhial/i,
      /fisioterap/i,
      /psicolog/i,
      /dentist/i,
    ],
  },
  // --- Fitness ---
  {
    category: "Sport e palestra",
    patterns: [/palestra/i, /gym\b/i, /fitactive/i, /mcfit/i, /virgin active/i, /keep fit/i, /sport center/i],
  },
  // --- Cura persona ---
  {
    category: "Bellezza",
    patterns: [/parrucchi/i, /barbiere/i, /estetica/i, /sephora/i, /douglas/i, /kiko\b/i, /nail/i, /massagg/i],
  },
  // --- Formazione e libri ---
  {
    category: "Educazione",
    patterns: [/udemy/i, /coursera/i, /universit/i, /scuola/i, /feltrinelli/i, /libreria/i, /amazon.*book/i],
  },
  { category: "Animali", patterns: [/veterinar/i, /pet shop/i, /zooplus/i, /arcaplanet/i, /pet\b/i] },
  // --- Donazioni e regali ---
  {
    category: "Regali e donazioni",
    patterns: [/regalo/i, /gift/i, /donazione/i, /bollettino 896/i, /telethon/i, /caritas/i],
  },
  // --- Bricolage e manutenzione abitazione ---
  {
    category: "Casa",
    patterns: [
      /leroy merlin/i,
      /brico/i,
      /obi\b/i,
      /castorama/i,
      /magazzini gabrielli/i,
      /mobili/i,
      /manutenzione casa/i,
      /idraul/i,
      /elettricista/i,
      /imbianch/i,
    ],
  },
  // --- Moda ---
  {
    category: "Abbigliamento",
    patterns: [
      /zara/i,
      /lefties/i,
      /h&m/i,
      /ovs\b/i,
      /benetton/i,
      /pull.?bear/i,
      /bershka/i,
      /stradivarius/i,
      /massimo dutti/i,
      /calzedonia/i,
      /intimissimi/i,
      /foot locker/i,
      /nike\b/i,
      /adidas/i,
      /decathlon/i,
      /italian concept/i,
    ],
  },
  // --- Retail tech ---
  {
    category: "Elettronica",
    patterns: [/mediaworld/i, /media world/i, /unieuro/i, /trony/i, /euronics/i, /apple store/i, /samsung shop/i],
  },
  // --- E-commerce generico ---
  {
    category: "Shopping",
    patterns: [/amazon/i, /zalando/i, /ikea/i, /m\.a\.g\./i, /aliexpress/i, /temu\b/i, /shein/i, /prozis/i],
  },
];

/**
 * Assegna categoria italiana standard.
 * @param description - Testo mostrato (pulito)
 * @param tipologia - Colonna tipologia Mediolanum o tipo Revolut
 * @param rawDescription - Causale grezza per pattern aggiuntivi
 * @returns Nome categoria (vedi CATEGORIES)
 */
export function categorize(
  description: string,
  tipologia = "",
  rawDescription = "",
): string {
  const hay = `${description} ${rawDescription}`;
  const tipo = tipologia.toLowerCase();

  if (tipo.includes("stipendi") || tipo.includes("pensioni") || /emolumenti/i.test(hay)) {
    return "Stipendio";
  }

  if (tipo.includes("mutui") || tipo.includes("prestiti")) return "Mutuo";
  if (tipo.includes("carte") && /prelievo/i.test(hay)) return "Prelievi";
  if (/avvera/i.test(hay) && /payment loan|installment/i.test(hay)) return "Finanziamento auto";
  if (isFuelPurchase(hay)) return "Trasporti";
  if (isVacationSpend(hay)) return "Vacanze";
  if (isHospitalityVenue(hay)) return "Ristoranti";

  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(hay))) return rule.category;
  }

  if (tipo.includes("bonifici")) return "Trasferimenti";
  if (tipo.includes("addebiti")) return "Abbonamenti";
  if (tipo.includes("ricariche") || tipo === "ricarica") return "Trasferimenti";
  if (tipo.includes("interessi")) return "Interessi";
  if (/bollettin/i.test(hay)) return "Banca e commissioni";
  // Mediolanum: tipologia “Prelievi” include POS carta; solo ATM/contante resta Prelievi
  if (tipo.includes("prelievi")) {
    if (/prelievo|atm|maxiprelievo|contante/i.test(hay)) return "Prelievi";
    if (isFuelPurchase(hay)) return "Trasporti";
    return "Shopping";
  }

  return "Altro";
}

/** Elenco categorie ammesse in UI picker e budget (ordine display). */
export const CATEGORIES = [
  "Stipendio",
  "Affitto",
  "Mutuo",
  "Finanziamento auto",
  "Bollette",
  "Assicurazioni",
  "Abbonamenti",
  "Spesa",
  "Ristoranti",
  "Trasporti",
  "Auto e manutenzione",
  "Vacanze",
  "Intrattenimento",
  "Casa",
  "Shopping",
  "Abbigliamento",
  "Elettronica",
  "Sport e palestra",
  "Bellezza",
  "Salute",
  "Educazione",
  "Animali",
  "Regali e donazioni",
  "Investimenti",
  "Banca e commissioni",
  "Interessi",
  "Trasferimenti",
  "Prelievi",
  "Altro",
] as const;
