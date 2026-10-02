import type { Period } from "../types";

/** UI labels: Dashboard uses long form; Advisor may use short "3 mesi". */
export const PERIOD_LABELS: Record<Period, string> = {
  month: "Questo mese",
  "30d": "Ultimi 30 giorni",
  "3m": "Ultimi 3 mesi",
  all: "Tutto",
};

/** Compact chips (Advisor). */
export const PERIOD_LABELS_SHORT: Record<Period, string> = {
  month: "Questo mese",
  "30d": "Ultimi 30 giorni",
  "3m": "3 mesi",
  all: "Tutto",
};
