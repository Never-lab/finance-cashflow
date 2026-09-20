/**
 * Tipi condivisi modulo quotazioni (barra OHLC giornaliera normalizzata).
 * Ruolo: quotes — usato da yahoo, finnhub e cache SQLite.
 */

/** Barra quotazione giornaliera normalizzata per l'API e quotes_cache. */
export type QuoteBar = {
  asOf: string; // YYYY-MM-DD
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  source: string;
};
