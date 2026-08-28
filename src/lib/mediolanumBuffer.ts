import type { Transaction } from "../types";
import type { LiquidityView } from "./liquidity";
import { isEmergencyFundTransfer } from "./knownAccounts";
import { mergeLoanTargets } from "./knownLoans";
import { buildLoanSummary } from "./loans";
import { findRecurring, isSubscriptionLike } from "./recurring";

/** Extra headroom when a plan closes and surplus can be redirected. */
export const MEDIOLANUM_BUFFER_OVERSHOOT = 30;

const ACTIVE_DAYS = 95;

export type MediolanumBufferLine = {
  id: string;
  label: string;
  monthly: number;
  active: boolean;
};

export type MediolanumBufferView = {
  lines: MediolanumBufferLine[];
  monthlyBase: number;
  recommendedNormal: number;
  recommendedPeak: number;
  peakMonth: string | null;
  currentAvailable: number | null;
  gap: number | null;
  status: "ok" | "low" | "critical" | "unknown";
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round10(n: number): number {
  return Math.ceil(n / 10) * 10;
}

function mediolanumTx(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.source === "mediolanum");
}

function referenceDate(transactions: Transaction[]): Date {
  const med = mediolanumTx(transactions);
  const last = med.sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
  if (last) return new Date(`${last}T12:00:00`);
  return new Date();
}

function isActive(lastDate: string, ref: Date): boolean {
  const d = new Date(`${lastDate}T12:00:00`);
  const diff = (ref.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diff <= ACTIVE_DAYS;
}

function lastMatching(
  txns: Transaction[],
  pred: (t: Transaction) => boolean,
): Transaction | null {
  const hits = txns.filter(pred).sort((a, b) => b.date.localeCompare(a.date));
  return hits[0] ?? null;
}

function isPaypalOnMed(t: Transaction): boolean {
  if (t.amount >= 0 || t.source !== "mediolanum") return false;
  const d = t.description.toLowerCase();
  if (!/paypal|pypl|paga in 3|paymthly/i.test(d)) return false;
  if (/addebito diretto|paypal europe|pplx/i.test(d)) return true;
  return /c\/o paypal/i.test(d);
}

function isMedBufferOutflow(t: Transaction): boolean {
  if (t.amount >= 0 || t.source !== "mediolanum") return false;
  const d = t.description.toLowerCase();
  return (
    /avvera|payment loan/i.test(d) ||
    /pag\.\s*mutuo|fin\.\s*vari|00136196/i.test(d) ||
    /addebito diretto|sdd|rcur|pagamento utenza telefonica/i.test(d) ||
    isEmergencyFundTransfer(t) ||
    /cofidis|compass|satispay|sky|fastweb/i.test(d) ||
    isPaypalOnMed(t) ||
    /cursor|amazon prime|google one|klarna/i.test(d)
  );
}

function bucketId(t: Transaction): string | null {
  const d = t.description.toLowerCase();
  if (/avvera|payment loan/i.test(d)) return "avvera";
  if (/00136196|pag\.\s*mutuo|fin\.\s*vari/i.test(d)) return "selfy";
  if (isEmergencyFundTransfer(t)) return "emergency";
  if (/fastweb/i.test(d)) return "fastweb";
  if (/\bsky\b/i.test(d)) return "sky";
  if (/compass/i.test(d)) return "compass";
  if (/cofidis/i.test(d)) return "cofidis";
  if (/satispay/i.test(d)) return "satispay";
  if (isPaypalOnMed(t)) return "paypal";
  if (/cursor/i.test(d)) return "cursor";
  if (/amazon prime/i.test(d)) return "amazon-prime";
  if (/google one/i.test(d)) return "google-one";
  return null;
}

const BUCKET_LABELS: Record<string, string> = {
  avvera: "Avvera auto",
  selfy: "Selfycredit",
  emergency: "Fondo emergenza (BP)",
  fastweb: "Fastweb",
  sky: "Sky",
  compass: "Compass",
  cofidis: "Cofidis Amazon",
  satispay: "Satispay ricarica",
  paypal: "PayPal SDD + carta",
  cursor: "Cursor",
  "amazon-prime": "Amazon Prime",
  "google-one": "Google One",
};

function detectLines(med: Transaction[], ref: Date): MediolanumBufferLine[] {
  const lines: MediolanumBufferLine[] = [];
  const loans = buildLoanSummary(med, mergeLoanTargets({}));

  for (const plan of loans.plans) {
    if (plan.key.startsWith("avvera-") || /avvera/i.test(plan.label)) {
      lines.push({
        id: "avvera",
        label: "Avvera auto",
        monthly: plan.installmentAmount,
        active: isActive(plan.lastDate, ref),
      });
    } else if (plan.key.includes("00136196") || /selfy/i.test(plan.label)) {
      lines.push({
        id: "selfy",
        label: "Selfycredit",
        monthly: plan.installmentAmount,
        active: isActive(plan.lastDate, ref),
      });
    }
  }

  const bucketIds = [
    "emergency",
    "fastweb",
    "sky",
    "compass",
    "cofidis",
    "satispay",
    "cursor",
    "amazon-prime",
    "google-one",
  ] as const;

  for (const id of bucketIds) {
    const last = lastMatching(med, (t) => bucketId(t) === id && t.amount < 0);
    if (!last) continue;
    lines.push({
      id,
      label: BUCKET_LABELS[id] ?? id,
      monthly: round2(-last.amount),
      active: isActive(last.date, ref),
    });
  }

  // PayPal: average of last 3 calendar months on Mediolanum
  const months = [...new Set(med.map((t) => t.date.slice(0, 7)))].sort().slice(-3);
  if (months.length > 0) {
    let paypalSum = 0;
    for (const m of months) {
      paypalSum += med
        .filter((t) => t.date.startsWith(m) && isPaypalOnMed(t))
        .reduce((s, t) => s + -t.amount, 0);
    }
    const paypalMonthly = round2(paypalSum / months.length);
    const lastPaypal = lastMatching(med, isPaypalOnMed);
    if (paypalMonthly > 0 || lastPaypal) {
      lines.push({
        id: "paypal",
        label: "PayPal SDD + carta (media 3m)",
        monthly: paypalMonthly,
        active: lastPaypal ? isActive(lastPaypal.date, ref) : false,
      });
    }
  }

  // Card subscriptions detected by recurring engine (dedupe cursor/sky)
  const seen = new Set(lines.map((l) => l.id));
  for (const r of findRecurring(med).filter(isSubscriptionLike)) {
    if (r.monthlyEstimate < 5 || r.count < 2) continue;
    const low = r.label.toLowerCase();
    if (/avvera|selfy|mutuo|fastweb|sky|satispay|paypal|compass|cofidis|emergenza/i.test(low)) {
      continue;
    }
    const id = `rec-${r.key.slice(0, 24)}`;
    if (seen.has(id) || seen.has("cursor") && /cursor/i.test(low)) continue;
    const last = r.lastDate;
    lines.push({
      id,
      label: r.label.slice(0, 42),
      monthly: round2(r.monthlyEstimate),
      active: isActive(last, ref),
    });
    seen.add(id);
  }

  lines.sort((a, b) => b.monthly - a.monthly);
  return lines;
}

function peakMonthTotal(med: Transaction[]): { month: string; total: number } | null {
  const months = [...new Set(med.map((t) => t.date.slice(0, 7)))].sort().slice(-3);
  let best: { month: string; total: number } | null = null;
  for (const m of months) {
    const total = round2(
      med
        .filter((t) => t.date.startsWith(m) && isMedBufferOutflow(t))
        .reduce((s, t) => s + -t.amount, 0),
    );
    if (!best || total > best.total) best = { month: m, total };
  }
  return best;
}

export function buildMediolanumBuffer(
  transactions: Transaction[],
  liquidity: LiquidityView | null,
): MediolanumBufferView | null {
  const med = mediolanumTx(transactions);
  if (med.length === 0) return null;

  const ref = referenceDate(transactions);
  const lines = detectLines(med, ref);
  const activeLines = lines.filter((l) => l.active);
  const monthlyBase = round2(activeLines.reduce((s, l) => s + l.monthly, 0));

  const peak = peakMonthTotal(med);
  const recommendedNormal = round10(monthlyBase + MEDIOLANUM_BUFFER_OVERSHOOT);
  const recommendedPeak = peak
    ? round10(peak.total + MEDIOLANUM_BUFFER_OVERSHOOT)
    : recommendedNormal;

  const currentAvailable = liquidity?.mediolanum?.available ?? null;
  let gap: number | null = null;
  let status: MediolanumBufferView["status"] = "unknown";

  if (currentAvailable != null) {
    gap = round2(Math.max(0, recommendedNormal - currentAvailable));
    if (currentAvailable >= recommendedNormal) status = "ok";
    else if (currentAvailable >= recommendedNormal * 0.75) status = "low";
    else status = "critical";
  }

  return {
    lines: activeLines.length > 0 ? activeLines : lines,
    monthlyBase,
    recommendedNormal,
    recommendedPeak,
    peakMonth: peak?.month ?? null,
    currentAvailable,
    gap,
    status,
  };
}
