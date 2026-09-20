/**
 * Snapshot liquidità (JSON in settings) e vista derivata dalle transazioni.
 * Ruolo: repo — chiave settings `liquidity_snapshots`.
 * Privacy: saldi manuali/opzionali per conto; associati a user_id.
 */
import type Database from "better-sqlite3";
import type { Transaction } from "@shared/types";
import {
  buildLiquidityView,
  mergeLiquiditySnapshots,
  type LiquiditySnapshots,
  type LiquidityView,
} from "@shared/lib/liquidity";
import { getSetting, setSetting } from "./settingsRepo";

const KEY = "liquidity_snapshots";

/** Carica snapshot persistiti o oggetto vuoto. */
export function loadLiquiditySnapshots(db: Database.Database, userId: number): LiquiditySnapshots {
  const raw = getSetting(db, userId, KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as LiquiditySnapshots;
  } catch {
    return {};
  }
}

/** Serializza e salva snapshot liquidità. */
export function saveLiquiditySnapshots(
  db: Database.Database,
  userId: number,
  snapshots: LiquiditySnapshots,
): void {
  setSetting(db, userId, KEY, JSON.stringify(snapshots));
}

/** Merge patch su snapshot esistenti e persistenza. */
export function mergeLiquidityPatch(
  db: Database.Database,
  userId: number,
  patch: Partial<LiquiditySnapshots>,
): LiquiditySnapshots {
  const merged = mergeLiquiditySnapshots(loadLiquiditySnapshots(db, userId), patch);
  saveLiquiditySnapshots(db, userId, merged);
  return merged;
}

/** Vista UI: combina snapshot e transazioni (@shared buildLiquidityView). */
export function loadLiquidityView(
  db: Database.Database,
  userId: number,
  transactions: Transaction[],
): LiquidityView {
  return buildLiquidityView(loadLiquiditySnapshots(db, userId), transactions);
}
