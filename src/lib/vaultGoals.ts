import type { Transaction } from "../types";

export const VAULT_DEFAULTS = {
  auto: {
    id: "auto" as const,
    label: "Vault Auto",
    target: 2500,
    deadline: "2026-11-30",
    monthlyHint: null as number | null,
  },
  casa: {
    id: "casa" as const,
    label: "Vault Casa",
    target: 10_000,
    deadline: null as string | null,
    monthlyHint: 380,
  },
  /** P0 switches from Auto to Casa on this local calendar date (inclusive for Casa). */
  p0SwitchDate: "2026-12-01",
} as const;

export type VaultId = "auto" | "casa";

export type VaultBalancesOverride = Partial<Record<VaultId, number | null>>;

export type VaultBalanceSource = "estimate" | "override";

export type VaultGoal = {
  id: VaultId;
  label: string;
  current: number;
  target: number;
  remaining: number;
  pct: number;
  monthlyHint: number | null;
  deadline: string | null;
  isP0: boolean;
  source: VaultBalanceSource;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 1000) / 10);
}

/** Vault Auto pocket — not Manutenzione Auto. */
function isVaultAutoCredit(description: string): boolean {
  return /accredita eur (?!manutenzione\s)auto\b/i.test(description);
}

function isVaultCasaCredit(description: string): boolean {
  return /accredita eur casa\b/i.test(description);
}

function isVaultAutoWithdrawal(description: string): boolean {
  const d = description.toLowerCase();
  if (!/prelievo da pocket/i.test(d)) return false;
  if (/manutenzione\s+auto/.test(d)) return false;
  return /\bauto\b/.test(d);
}

function isVaultCasaWithdrawal(description: string): boolean {
  return /prelievo da pocket/i.test(description) && /\bcasa\b/i.test(description);
}

export function estimateVaultBalances(transactions: Transaction[]): Record<VaultId, number> {
  let auto = 0;
  let casa = 0;

  const revolut = transactions
    .filter((t) => t.source === "revolut")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  for (const t of revolut) {
    const d = t.description;
    if (isVaultAutoCredit(d)) auto += t.amount;
    else if (isVaultCasaCredit(d)) casa += t.amount;
    else if (isVaultAutoWithdrawal(d)) auto += t.amount; // amount already negative
    else if (isVaultCasaWithdrawal(d)) casa += t.amount;
  }

  return {
    auto: round2(Math.max(0, auto)),
    casa: round2(Math.max(0, casa)),
  };
}

export function mergeVaultBalance(
  estimate: number,
  override: number | null | undefined,
): { current: number; source: VaultBalanceSource } {
  if (override != null && Number.isFinite(override)) {
    return { current: round2(Math.max(0, override)), source: "override" };
  }
  return { current: round2(Math.max(0, estimate)), source: "estimate" };
}

export function vaultP0Id(now: Date = new Date()): VaultId {
  const switchDay = VAULT_DEFAULTS.p0SwitchDate;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return today >= switchDay ? "casa" : "auto";
}

export function buildVaultGoals(
  transactions: Transaction[],
  overrides: VaultBalancesOverride = {},
  now: Date = new Date(),
): VaultGoal[] {
  const estimated = estimateVaultBalances(transactions);
  const p0 = vaultP0Id(now);

  return (["auto", "casa"] as const).map((id) => {
    const def = VAULT_DEFAULTS[id];
    const { current, source } = mergeVaultBalance(estimated[id], overrides[id]);
    const remaining = round2(Math.max(0, def.target - current));
    return {
      id,
      label: def.label,
      current,
      target: def.target,
      remaining,
      pct: pct(current, def.target),
      monthlyHint: def.monthlyHint,
      deadline: def.deadline,
      isP0: p0 === id,
      source,
    };
  });
}
