/**
 * Privacy UI: maschera importi € a schermo (shoulder surfing).
 * Flag in-memory + localStorage; formatEur shared resta invariato.
 */
import { formatEur } from "@shared/lib/stats";

export const PRIVACY_AMOUNTS_KEY = "cashflow-privacy-amounts";
export const MASKED_EUR = "••••••";

let masked = false;

/** Legge preferenza da localStorage (safe se storage bloccato). */
export function loadPrivacyAmounts(): boolean {
  try {
    masked = localStorage.getItem(PRIVACY_AMOUNTS_KEY) === "1";
  } catch {
    masked = false;
  }
  return masked;
}

export function isPrivacyAmountsOn(): boolean {
  return masked;
}

/** Persiste e aggiorna flag in-memory. */
export function setPrivacyAmounts(on: boolean): void {
  masked = on;
  try {
    localStorage.setItem(PRIVACY_AMOUNTS_KEY, on ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

/** Importo € per UI: mascherato o formatEur. */
export function formatEurDisplay(n: number): string {
  return masked ? MASKED_EUR : formatEur(n);
}

/** Asse/compact number usato per scale € nei grafici. */
export function formatCompactNumber(n: number): string {
  if (masked) return "••••";
  return new Intl.NumberFormat("it-IT", {
    notation: "compact",
    compactDisplay: "short",
  }).format(n);
}
