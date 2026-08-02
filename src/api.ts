import type { AppState, RecurringMark, Transaction } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const api = {
  getState: () => fetch("/api/state").then((r) => json<AppState>(r)),
  mergeTransactions: (transactions: Transaction[]) =>
    fetch("/api/transactions/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions }),
    }).then((r) => json<{ added: number; updated: number; state: AppState }>(r)),
  setCategory: (id: string, category: string) =>
    fetch("/api/overrides/category", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, category }),
    }).then((r) => json<AppState>(r)),
  setInternal: (id: string, internal: boolean) =>
    fetch("/api/overrides/internal", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, internal }),
    }).then((r) => json<AppState>(r)),
  setRecurring: (key: string, mark: RecurringMark) =>
    fetch("/api/overrides/recurring", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, mark }),
    }).then((r) => json<AppState>(r)),
  migrate: (state: AppState, force = false) =>
    fetch("/api/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...state, force }),
    }).then((r) => json<{ ok: boolean; state: AppState }>(r)),
};
