import type Database from "better-sqlite3";
import type { Transaction } from "../../src/types";
import {
  buildLiquidityView,
  mergeLiquiditySnapshots,
  type LiquiditySnapshots,
  type LiquidityView,
} from "../../src/lib/liquidity";
import { getSetting, setSetting } from "./settingsRepo";

const KEY = "liquidity_snapshots";

export function loadLiquiditySnapshots(db: Database.Database): LiquiditySnapshots {
  const raw = getSetting(db, KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as LiquiditySnapshots;
  } catch {
    return {};
  }
}

export function saveLiquiditySnapshots(db: Database.Database, snapshots: LiquiditySnapshots): void {
  setSetting(db, KEY, JSON.stringify(snapshots));
}

export function mergeLiquidityPatch(db: Database.Database, patch: Partial<LiquiditySnapshots>): LiquiditySnapshots {
  const merged = mergeLiquiditySnapshots(loadLiquiditySnapshots(db), patch);
  saveLiquiditySnapshots(db, merged);
  return merged;
}

export function loadLiquidityView(db: Database.Database, transactions: Transaction[]): LiquidityView {
  return buildLiquidityView(loadLiquiditySnapshots(db), transactions);
}
