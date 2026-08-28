const RULES: { category: string; patterns: RegExp[] }[] = [
  { category: "Stipendio", patterns: [/stipendio/i, /salary/i, /accredito stipendio/i, /disposizione vs\.?\s*favore/i] },
  { category: "Affitto", patterns: [/affitto/i, /rent/i, /locazione/i] },
  { category: "Mutuo", patterns: [/mutuo/i, /fin\.\s*vari/i, /pag\.\s*mutuo/i] },
  {
    category: "Finanziamento auto",
    patterns: [/avvera.*payment loan/i, /payment loan.*avvera/i, /prg\.car.*avvera/i],
  },
  { category: "Bollette", patterns: [/enel/i, /eni\b/i, /acea/i, /hera/i, /bolletta/i, /fastweb/i, /tim\b/i, /vodafone/i, /windtre/i, /utenza telefonica/i] },
  { category: "Spesa", patterns: [/essellunga/i, /esselunga/i, /coop\b/i, /conad/i, /carrefour/i, /lidl/i, /aldi/i, /supermercato/i, /maury/i, /super a&o/i, /grocery/i] },
  { category: "Ristoranti", patterns: [/ristorante/i, /trattoria/i, /pizzeria/i, /mcdonald/i, /deliveroo/i, /glovo/i, /just.?eat/i, /uber.?eats/i, /caff[eè]/i, /gelateria/i, /bora bora/i] },
  { category: "Trasporti", patterns: [/trenitalia/i, /italo/i, /uber\b/i, /taxi/i, /carburante/i, /telepass/i, /autostrade/i] },
  { category: "Salute", patterns: [/farmacia/i, /ospedale/i, /medico/i, /dental/i, /asl\b/i] },
  {
    category: "Assicurazioni",
    patterns: [
      /allianz/i,
      /assicur/i,
      /unipol/i,
      /generali/i,
      /\baxa\b/i,
      /reale mutua/i,
    ],
  },
  { category: "Abbonamenti", patterns: [/netflix/i, /spotify/i, /amazon prime/i, /disney/i, /youtube.?premium/i, /\bsky\b/i, /cursor/i, /klarna/i] },
  { category: "Interessi", patterns: [/interessi netti/i, /\binterest\b/i] },
  { category: "Trasferimenti", patterns: [/bonifico/i, /giroconto/i, /transfer/i, /revolut/i, /ricarica/i, /satispay/i, /paypal/i, /accredita eur/i, /deposito senza vincoli/i, /pagamento da /i, /^to /i, /^dal deposito/i, /^per i depositi/i] },
  { category: "Prelievi", patterns: [/prelievo/i, /atm withdrawal/i, /prelevamento/i, /maxiprelievo/i] },
  { category: "Shopping", patterns: [/amazon/i, /zalando/i, /ikea/i, /mediaworld/i, /decathlon/i, /zara/i, /the space/i] },
];

export function categorize(
  description: string,
  tipologia = "",
  rawDescription = "",
): string {
  const hay = `${description} ${rawDescription}`;
  const tipo = tipologia.toLowerCase();

  if (tipo.includes("mutui") || tipo.includes("prestiti")) return "Mutuo";
  if (tipo.includes("carte") && /prelievo/i.test(hay)) return "Prelievi";
  if (/avvera/i.test(hay) && /payment loan|installment/i.test(hay)) return "Finanziamento auto";

  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(hay))) return rule.category;
  }

  if (tipo.includes("bonifici")) return "Trasferimenti";
  if (tipo.includes("addebiti")) return "Abbonamenti";
  if (tipo.includes("ricariche") || tipo === "ricarica") return "Trasferimenti";
  if (tipo.includes("interessi")) return "Interessi";
  // Mediolanum labels card POS as "Prelievi - Pagamenti"; cash ATM stays Prelievi
  if (tipo.includes("prelievi")) {
    if (/prelievo|atm|maxiprelievo|contante/i.test(hay)) return "Prelievi";
    return "Shopping";
  }

  return "Altro";
}

export const CATEGORIES = [
  "Stipendio",
  "Affitto",
  "Mutuo",
  "Finanziamento auto",
  "Bollette",
  "Spesa",
  "Ristoranti",
  "Trasporti",
  "Salute",
  "Assicurazioni",
  "Abbonamenti",
  "Interessi",
  "Trasferimenti",
  "Prelievi",
  "Shopping",
  "Altro",
] as const;
