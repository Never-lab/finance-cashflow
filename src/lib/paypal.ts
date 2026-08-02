import type { Transaction } from "../types";
import { formatEur } from "./stats";

export type PaypalKind = "pay_in_3" | "pay_monthly" | "sdd" | "other" | "in";

export type PaypalPlan = {
  key: string;
  kind: PaypalKind;
  label: string;
  installmentAmount: number;
  paidCount: number;
  /** Expected installments if known (3 for Paga in 3); null for open-ended */
  expectedCount: number | null;
  remainingEstimate: number | null;
  totalPaid: number;
  dates: string[];
  lastDate: string;
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

/** Group PayPal outflows into installment plans by kind + amount. */
export function buildPaypalSummary(txns: Transaction[]): PaypalSummary {
  const paypal = txns.filter(isPaypalTransaction);
  const income = paypal.filter((t) => t.amount > 0).sort((a, b) => b.date.localeCompare(a.date));
  const out = paypal.filter((t) => t.amount < 0);

  const planBuckets = new Map<string, Transaction[]>();
  const otherOut: Transaction[] = [];

  for (const t of out) {
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

  const plans: PaypalPlan[] = [];
  for (const [key, list] of planBuckets) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const kind = classifyPaypal(sorted[0]!);
    const installmentAmount = round2(-sorted[0]!.amount);
    const paidCount = sorted.length;
    const expectedCount = kind === "pay_in_3" ? 3 : null;
    const totalPaid = round2(sorted.reduce((s, t) => s + -t.amount, 0));

    let remainingEstimate: number | null = null;
    let status: PaypalPlan["status"] = "ongoing";

    if (kind === "pay_in_3") {
      const left = Math.max(0, 3 - paidCount);
      remainingEstimate = round2(left * installmentAmount);
      status = left === 0 ? "likely_done" : "active";
    } else if (kind === "pay_monthly" || kind === "sdd") {
      status = "ongoing";
      remainingEstimate = null;
    }

    const dates = sorted.map((t) => t.date);
    plans.push({
      key,
      kind,
      label: `${kindLabel(kind)} · ${formatEur(installmentAmount)}`,
      installmentAmount,
      paidCount,
      expectedCount,
      remainingEstimate,
      totalPaid,
      dates,
      lastDate: dates.at(-1) ?? "",
      status,
      transactions: sorted,
    });
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
  const remainingDebt = round2(
    plans
      .filter((p) => p.remainingEstimate != null)
      .reduce((s, p) => s + (p.remainingEstimate ?? 0), 0),
  );

  return { plans, otherOut, income, totalOut, totalIn, remainingDebt };
}
