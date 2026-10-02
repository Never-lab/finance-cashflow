import type { Transaction } from "../types";
import {
  KNOWN_PAYPAL_PLANS,
  matchKnownPaypalPlan,
  type KnownPaypalPlan,
} from "./knownPaypal";
import { formatEur } from "./stats";

export type PaypalKind = "pay_in_3" | "pay_monthly" | "sdd" | "other" | "in";

/** Stored overrides for known PayPal plans (settings key paypal_targets). */
export type PaypalTarget = {
  remainingDebt?: number;
  paidCount?: number;
};

export type PaypalPlan = {
  key: string;
  kind: PaypalKind;
  label: string;
  merchantLabel: string | null;
  installmentAmount: number;
  paidCount: number;
  /** Expected installments if known (3 for Paga in 3); null for open-ended */
  expectedCount: number | null;
  remainingEstimate: number | null;
  remainingSource: "paypal" | "estimate" | null;
  totalPaid: number;
  totalRepaidPaypal: number | null;
  dates: string[];
  lastDate: string;
  nextPaymentDate: string | null;
  startDate: string | null;
  principalAmount: number | null;
  totalAmount: number | null;
  indicativeTaeg: number | null;
  status: "active" | "likely_done" | "ongoing";
  transactions: Transaction[];
};

export type PaypalSummary = {
  plans: PaypalPlan[];
  otherOut: Transaction[];
  income: Transaction[];
  totalOut: number;
  totalIn: number;
  remainingDebt: number;
  monthlyBurden: number;
};

export function isPaypalTransaction(t: Transaction): boolean {
  const d = t.description.toLowerCase();
  return (
    d.includes("paypal") ||
    d.includes("pypl") ||
    d.includes("paga in 3") ||
    d.includes("paymthly")
  );
}

export function classifyPaypal(t: Transaction): PaypalKind {
  const d = t.description.toLowerCase();
  if (t.amount > 0) return "in";
  if (/paga in 3|pay in 3|payin3/i.test(d)) return "pay_in_3";
  if (/paymthly|pay monthly|pagamento mensile/i.test(d)) return "pay_monthly";
  if (/addebito diretto|paypal europe|sdd/i.test(d) && /paypal/i.test(d)) return "sdd";
  return "other";
}

function kindLabel(kind: PaypalKind): string {
  switch (kind) {
    case "pay_in_3":
      return "Paga in 3";
    case "pay_monthly":
      return "Pay Monthly";
    case "sdd":
      return "Addebito PayPal (SDD)";
    case "in":
      return "Accredito PayPal";
    default:
      return "Altro PayPal";
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function countInstallmentDates(txs: Transaction[], installmentAmount: number): number {
  const byDate = new Map<string, number>();
  for (const t of txs) {
    byDate.set(t.date, round2((byDate.get(t.date) ?? 0) + -t.amount));
  }
  let count = 0;
  for (const sum of byDate.values()) {
    if (Math.abs(sum - installmentAmount) < 0.02) count++;
  }
  return count;
}

function withOverride(known: KnownPaypalPlan, ov?: PaypalTarget): KnownPaypalPlan {
  if (!ov) return known;
  return {
    ...known,
    ...(ov.remainingDebt != null ? { remainingDebt: ov.remainingDebt } : {}),
    ...(ov.paidCount != null ? { paidCount: ov.paidCount } : {}),
  };
}

function planFromKnown(known: KnownPaypalPlan, txs: Transaction[]): PaypalPlan {
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  const dates = sorted.map((t) => t.date);
  const csvPaid = countInstallmentDates(sorted, known.installmentAmount);
  const paidCount = Math.max(csvPaid, known.paidCount ?? 0);
  const totalPaid = round2(sorted.reduce((s, t) => s + -t.amount, 0));
  const done =
    paidCount >= known.totalInstallments || known.remainingDebt === 0;

  let remainingEstimate: number | null = null;
  let remainingSource: PaypalPlan["remainingSource"] = null;
  let status: PaypalPlan["status"];

  if (done) {
    remainingEstimate = 0;
    remainingSource =
      known.remainingDebt === 0 ? "paypal" : "estimate";
    status = "likely_done";
  } else if (known.remainingDebt != null && known.remainingDebt > 0) {
    remainingEstimate = round2(known.remainingDebt);
    remainingSource = "paypal";
    status = "active";
  } else {
    const left = Math.max(0, known.totalInstallments - paidCount);
    remainingEstimate = round2(left * known.installmentAmount);
    remainingSource = "estimate";
    status = left === 0 ? "likely_done" : "active";
  }

  return {
    key: known.key,
    kind: known.kind,
    label: known.label,
    merchantLabel: known.label,
    installmentAmount: known.installmentAmount,
    paidCount,
    expectedCount: known.totalInstallments,
    remainingEstimate,
    remainingSource,
    totalPaid,
    totalRepaidPaypal: known.totalRepaid != null ? round2(known.totalRepaid) : null,
    dates,
    lastDate: dates.at(-1) ?? "",
    nextPaymentDate: done ? null : (known.nextPaymentDate ?? null),
    startDate: known.startDate ?? null,
    principalAmount: known.principalAmount ?? null,
    totalAmount: known.totalAmount ?? null,
    indicativeTaeg: known.indicativeTaeg ?? null,
    status,
    transactions: sorted,
  };
}

function planFromBucket(key: string, list: Transaction[]): PaypalPlan {
  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
  const kind = classifyPaypal(sorted[0]!);
  const installmentAmount = round2(-sorted[0]!.amount);
  const paidCount = sorted.length;
  const expectedCount = kind === "pay_in_3" ? 3 : null;
  const totalPaid = round2(sorted.reduce((s, t) => s + -t.amount, 0));

  let remainingEstimate: number | null = null;
  let remainingSource: PaypalPlan["remainingSource"] = null;
  let status: PaypalPlan["status"] = "ongoing";

  if (kind === "pay_in_3") {
    const left = Math.max(0, 3 - paidCount);
    remainingEstimate = round2(left * installmentAmount);
    remainingSource = "estimate";
    status = left === 0 ? "likely_done" : "active";
  } else if (kind === "pay_monthly" || kind === "sdd") {
    status = "ongoing";
    remainingEstimate = null;
  }

  const dates = sorted.map((t) => t.date);
  return {
    key,
    kind,
    label: `${kindLabel(kind)} ┬À ${formatEur(installmentAmount)}`,
    merchantLabel: null,
    installmentAmount,
    paidCount,
    expectedCount,
    remainingEstimate,
    remainingSource,
    totalPaid,
    totalRepaidPaypal: null,
    dates,
    lastDate: dates.at(-1) ?? "",
    nextPaymentDate: null,
    startDate: null,
    principalAmount: null,
    totalAmount: null,
    indicativeTaeg: null,
    status,
    transactions: sorted,
  };
}

/** Group PayPal outflows into installment plans by kind + amount. */
export function buildPaypalSummary(
  txns: Transaction[],
  overrides: Record<string, PaypalTarget> = {},
): PaypalSummary {
  const paypal = txns.filter(isPaypalTransaction);
  const income = paypal.filter((t) => t.amount > 0).sort((a, b) => b.date.localeCompare(a.date));
  const out = paypal.filter((t) => t.amount < 0);

  const assigned = new Set<string>();
  const plans: PaypalPlan[] = [];

  for (const known of KNOWN_PAYPAL_PLANS) {
    const matched = out.filter((t) => {
      if (assigned.has(t.id)) return false;
      const kind = classifyPaypal(t);
      if (kind === "other" || kind === "in") return false;
      return matchKnownPaypalPlan(kind, round2(-t.amount), known);
    });
    for (const t of matched) assigned.add(t.id);
    if (matched.length > 0) {
      plans.push(planFromKnown(withOverride(known, overrides[known.key]), matched));
    }
  }

  const planBuckets = new Map<string, Transaction[]>();
  const otherOut: Transaction[] = [];

  for (const t of out) {
    if (assigned.has(t.id)) continue;
    const kind = classifyPaypal(t);
    if (kind === "other") {
      otherOut.push(t);
      continue;
    }
    const amt = round2(-t.amount);
    const key = `${kind}|${amt.toFixed(2)}`;
    const list = planBuckets.get(key) ?? [];
    list.push(t);
    planBuckets.set(key, list);
  }

  for (const [key, list] of planBuckets) {
    plans.push(planFromBucket(key, list));
  }

  plans.sort((a, b) => {
    const rank = (s: PaypalPlan["status"]) =>
      s === "active" ? 0 : s === "ongoing" ? 1 : 2;
    const d = rank(a.status) - rank(b.status);
    if (d !== 0) return d;
    return b.lastDate.localeCompare(a.lastDate);
  });

  otherOut.sort((a, b) => b.date.localeCompare(a.date));

  const totalOut = round2(out.reduce((s, t) => s + -t.amount, 0));
  const totalIn = round2(income.reduce((s, t) => s + t.amount, 0));

  // KPIs = piani noti (merchant da app PayPal). Bucket generici CSV restano in lista ma non gonfiano rate/debito.
  const knownOpen = plans.filter(
    (p) => p.merchantLabel && p.remainingEstimate != null && p.status !== "likely_done",
  );
  const knownActive = plans.filter((p) => p.merchantLabel && p.status === "active");
  const remainingDebt = round2(knownOpen.reduce((s, p) => s + (p.remainingEstimate ?? 0), 0));
  const monthlyBurden = round2(knownActive.reduce((s, p) => s + p.installmentAmount, 0));

  return { plans, otherOut, income, totalOut, totalIn, remainingDebt, monthlyBurden };
}
