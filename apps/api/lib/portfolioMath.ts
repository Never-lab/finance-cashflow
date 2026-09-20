/**
 * Calcolo aggregati portafoglio (valore, PnL, allocazione, serie storica v1).
 * Ruolo: lib pura — nessun I/O; usata da routes/portfolio.ts.
 * Input: strumenti/holding/prezzi o serie close da quotes_cache.
 */
import type { Holding, Instrument, InstrumentType } from "@shared/types";

export type PortfolioSummary = {
  totalValue: number;
  totalContributed: number;
  pnl: number;
  pnlPct: number | null;
  cashLiquidity: number; // risparmio + deposito cash_balance
  allocation: { type: InstrumentType; value: number; pct: number }[];
  lines: {
    instrumentId: string;
    name: string;
    type: InstrumentType;
    value: number;
    contributed: number;
    pnl: number;
    price: number | null;
  }[];
};

const CASH_TYPES = new Set<InstrumentType>(["risparmio", "deposito"]);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Con quantity valorizzata (strumento a ticker): quantity * price, o fallback
 * cost_basis se il prezzo non è disponibile. Senza quantity (cash/fondo senza
 * ticker): cash_balance ?? 0, il prezzo è irrilevante.
 */
/** Valore di mercato (o proxy) di una singola posizione. */
export function instrumentValue(h: Holding, price: number | null): number {
  if (h.quantity != null) {
    return price != null ? h.quantity * price : h.costBasis;
  }
  return h.cashBalance ?? 0;
}

/** Costruisce riepilogo portafoglio da righe strumento + holding + prezzo corrente. */
export function buildSummary(
  rows: { instrument: Instrument; holding: Holding; price: number | null }[],
): PortfolioSummary {
  const lines = rows.map(({ instrument, holding, price }) => {
    const value = instrumentValue(holding, price);
    const contributed = holding.costBasis;
    return {
      instrumentId: instrument.id,
      name: instrument.name,
      type: instrument.type,
      value: round2(value),
      contributed: round2(contributed),
      pnl: round2(value - contributed),
      price,
    };
  });

  const totalValue = round2(lines.reduce((s, l) => s + l.value, 0));
  const totalContributed = round2(lines.reduce((s, l) => s + l.contributed, 0));
  const pnl = round2(totalValue - totalContributed);
  const pnlPct = totalContributed !== 0 ? round2((pnl / totalContributed) * 100) : null;

  const cashLiquidity = round2(
    rows
      .filter((r) => CASH_TYPES.has(r.instrument.type))
      .reduce((s, r) => s + (r.holding.cashBalance ?? 0), 0),
  );

  const byType = new Map<InstrumentType, number>();
  for (const l of lines) {
    byType.set(l.type, (byType.get(l.type) ?? 0) + l.value);
  }
  const allocation = Array.from(byType.entries()).map(([type, value]) => ({
    type,
    value: round2(value),
    pct: totalValue !== 0 ? round2((value / totalValue) * 100) : 0,
  }));

  return { totalValue, totalContributed, pnl, pnlPct, cashLiquidity, allocation, lines };
}

export type HistoryLine = {
  quantity: number | null;
  cashBalance: number | null;
  closes: { asOf: string; close: number }[];
};

/** Ultima close con asOf <= date (carry-forward); 0 se nessuna quotazione disponibile ancora. */
function closeOnOrBefore(closes: { asOf: string; close: number }[], date: string): number {
  let best: { asOf: string; close: number } | null = null;
  for (const c of closes) {
    if (c.asOf <= date && (best === null || c.asOf > best.asOf)) {
      best = c;
    }
  }
  return best?.close ?? 0;
}

/**
 * v1: per ogni data, somma su tutte le righe (quantity ?? 0) * closeOnOrBefore(date) + (cashBalance ?? 0).
 * Le righe senza quantity (cash/fondo) contribuiscono solo con cash_balance, ignorando le closes.
 */
/** Serie valore portafoglio per ogni data nell'elenco (carry-forward prezzi). */
export function buildHistory(
  lines: HistoryLine[],
  dates: string[],
): { date: string; value: number }[] {
  return dates.map((date) => {
    const value = lines.reduce((sum, line) => {
      const qtyValue = (line.quantity ?? 0) * closeOnOrBefore(line.closes, date);
      return sum + qtyValue + (line.cashBalance ?? 0);
    }, 0);
    return { date, value: round2(value) };
  });
}
