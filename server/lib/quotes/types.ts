export type QuoteBar = {
  asOf: string; // YYYY-MM-DD
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  source: string;
};
