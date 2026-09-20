/**
 * Accesso legacy a IndexedDB nel browser e re-export delle utilità di stato condivise.
 * In produzione i dati vivono su SQLite via API; questo modulo serve solo alla migrazione
 * one-shot quando il server è vuoto ma il browser ha ancora movimenti salvati localmente.
 */
import { get, set } from "idb-keyval";
import type { AppState } from "@shared/types";
import { normalize } from "@shared/lib/appState";

/** Chiave IndexedDB storica — sola lettura/scrittura locale, usata per migrazione verso SQLite. */
const KEY = "finance-cashflow-v1";

/** Carica e normalizza lo stato salvato nel browser (se assente, stato vuoto). */
export async function loadState(): Promise<AppState> {
  const s = await get<AppState>(KEY);
  return normalize(s);
}

/** Persiste lo stato su IndexedDB (path legacy, non usato dal flusso API principale). */
export async function saveState(state: AppState): Promise<void> {
  await set(KEY, state);
}

export * from "@shared/lib/appState";
