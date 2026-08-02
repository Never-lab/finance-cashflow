import { get, set } from "idb-keyval";
import type { AppState } from "./types";
import { normalize } from "./lib/appState";

/** Legacy IndexedDB key — read-only, used for one-shot migration to SQLite. */
const KEY = "finance-cashflow-v1";

export async function loadState(): Promise<AppState> {
  const s = await get<AppState>(KEY);
  return normalize(s);
}

export async function saveState(state: AppState): Promise<void> {
  await set(KEY, state);
}

export * from "./lib/appState";
