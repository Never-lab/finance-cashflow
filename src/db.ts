import { get, set } from "idb-keyval";
import type { AppState, RecurringMark, Transaction } from "./types";
import { withResolvedInternal } from "./lib/internal";

const KEY = "finance-cashflow-v1";

export const emptyState = (): AppState => ({
  transactions: [],
  categoryOverrides: {},
  recurringMarks: {},
  internalOverrides: {},
});

function normalize(s: AppState | undefined): AppState {
  if (!s) return emptyState();
  return {
    transactions: s.transactions ?? [],
    categoryOverrides: s.categoryOverrides ?? {},
    recurringMarks: s.recurringMarks ?? {},
    internalOverrides: s.internalOverrides ?? {},
  };
}

export async function loadState(): Promise<AppState> {
  const s = await get<AppState>(KEY);
  return normalize(s);
}

export async function saveState(state: AppState): Promise<void> {
  await set(KEY, state);
}

/** Category + internal overrides; internal always re-resolved. */
export function withOverrides(state: AppState): Transaction[] {
  return state.transactions.map((t) => {
    const base = withResolvedInternal(t, state.internalOverrides);
    const cat = state.categoryOverrides[base.id];
    return cat ? { ...base, category: cat } : base;
  });
}

/** Upsert by id. Returns added + updated counts. */
export function mergeImport(
  state: AppState,
  incoming: Transaction[],
): { state: AppState; added: number; updated: number } {
  const byId = new Map(state.transactions.map((t) => [t.id, t]));
  let added = 0;
  let updated = 0;

  for (const row of incoming) {
    if (byId.has(row.id)) {
      const prev = byId.get(row.id)!;
      byId.set(row.id, {
        ...prev,
        date: row.date,
        description: row.description,
        amount: row.amount,
        currency: row.currency,
        source: row.source,
        category: row.category,
        internal: row.internal,
      });
      updated++;
    } else {
      byId.set(row.id, row);
      added++;
    }
  }

  return {
    state: {
      ...state,
      transactions: [...byId.values()].sort((a, b) => b.date.localeCompare(a.date)),
    },
    added,
    updated,
  };
}

export function setCategoryOverride(
  state: AppState,
  id: string,
  category: string,
): AppState {
  return {
    ...state,
    categoryOverrides: { ...state.categoryOverrides, [id]: category },
  };
}

export function setRecurringMark(
  state: AppState,
  key: string,
  mark: RecurringMark,
): AppState {
  const recurringMarks = { ...state.recurringMarks };
  if (!mark) delete recurringMarks[key];
  else recurringMarks[key] = mark;
  return { ...state, recurringMarks };
}

export function setInternalOverride(
  state: AppState,
  id: string,
  internal: boolean | null,
): AppState {
  const internalOverrides = { ...state.internalOverrides };
  if (internal === null) delete internalOverrides[id];
  else internalOverrides[id] = internal;
  return { ...state, internalOverrides };
}

export function exportStateJson(state: AppState): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2);
}

export function parseStateJson(text: string): AppState {
  const raw = JSON.parse(text) as Partial<AppState> & { version?: number };
  if (!Array.isArray(raw.transactions)) {
    throw new Error("Backup non valido: manca transactions[].");
  }
  return normalize(raw as AppState);
}
