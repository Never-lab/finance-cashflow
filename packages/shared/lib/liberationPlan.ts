/**
 * Piano “liberazione” debiti PayPal/Selfy e risparmio pocket Revolut (Viaggio, Lifecycle).
 *
 * Obiettivi percentuali per UI strategia; usa liquidità, PayPal e mutui da CSV + known defaults.
 */
import type { Transaction } from "../types";
import type { LiquidityView } from "./liquidity";
import { SELFYCREDIT_00136196, mergeLoanTargets } from "./knownLoans";
import { buildLoanSummary, type LoanTarget } from "./loans";
import { buildPaypalSummary } from "./paypal";
import { formatEur } from "./stats";

/** Target EUR e soglie fase (PayPal → Selfy) configurati owner. */
export const LIBERATION_DEFAULTS = {
  viaggioAnnualTarget: 1200,
  viaggioMonthly: 100,
  lifecycleTarget: 800,
  lifecycleMonthly: 100,
  attualeFloat: 200,
  paypalPhaseThreshold: 600,
  selfyPartialPayoff: 1000,
} as const;

/** Singolo obiettivo debt/savings con hint mensile e fase testuale. */
export type LiberationGoal = {
  id: string;
  label: string;
  kind: "debt" | "savings";
  current: number;
  target: number;
  remaining: number;
  monthlyHint: number | null;
  pct: number;
  hint: string;
  phase: string | null;
};

/** Insieme obiettivi + flag fase PayPal e stima EUR liberabile da Attuale. */
export type LiberationPlan = {
  goals: LiberationGoal[];
  paypalUnder600: boolean;
  liberabileEstimate: number | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 1000) / 10);
}

/** Saldo stimato pocket Lifecycle/Tech da movimenti “Accredita EUR …” su Risparmi. */
export function estimateLifecycleBalance(transactions: Transaction[]): number {
  let bal = 0;
  for (const t of transactions) {
    if (t.source !== "revolut") continue;
    const d = t.description.toLowerCase();
    if (/accredita eur (tech|lifecycle|telefono)/i.test(d)) bal += t.amount;
    else if (/prelievo da pocket/i.test(d) && /(tech|lifecycle|telefono)/i.test(d)) bal += t.amount;
  }
  return round2(Math.max(0, bal));
}

/**
 * Costruisce i quattro goal PayPal, Selfy, Viaggio, Lifecycle con percentuali avanzamento.
 */
export function buildLiberationPlan(
  transactions: Transaction[],
  loanTargets: Record<string, LoanTarget>,
  liquidity: LiquidityView | null,
): LiberationPlan {
  const paypal = buildPaypalSummary(transactions);
  const loans = buildLoanSummary(transactions, mergeLoanTargets(loanTargets));

  const paypalRepaid = round2(paypal.plans.reduce((s, p) => s + p.totalPaid, 0));
  const paypalRemaining = paypal.remainingDebt;
  const paypalTotal = round2(paypalRepaid + paypalRemaining);
  const activePaypal = paypal.plans.filter(
    (p) => p.merchantLabel && p.status === "active",
  ).length;

  const selfy = loans.plans.find((p) => p.key === SELFYCREDIT_00136196.key);
  const selfyPrincipal =
    selfy?.principalAmount ?? SELFYCREDIT_00136196.principalAmount ?? 3500;
  const selfyRepaid =
    selfy?.totalRepaidBank ?? selfy?.totalPaid ?? SELFYCREDIT_00136196.totalRepaid ?? 0;
  const selfyRemaining =
    selfy?.remainingEstimate ?? SELFYCREDIT_00136196.remainingDebt ?? 0;
  const selfyInstallment = selfy?.installmentAmount ?? 110;
  const selfyRemainingInstallments = selfy?.remainingInstallments ?? 28;

  const viaggioCurrent = liquidity?.pockets?.viaggio ?? 0;
  const lifecycleCurrent = estimateLifecycleBalance(transactions);

  const attuale = liquidity?.revolutAttualeEffective ?? liquidity?.revolut?.attuale ?? null;
  const liberabile =
    attuale != null ? round2(Math.max(0, attuale - LIBERATION_DEFAULTS.attualeFloat)) : null;

  const paypalUnder600 = paypalRemaining <= LIBERATION_DEFAULTS.paypalPhaseThreshold;

  const goals: LiberationGoal[] = [
    {
      id: "paypal",
      label: "PayPal — liberazione rate",
      kind: "debt",
      current: paypalRepaid,
      target: paypalTotal,
      remaining: paypalRemaining,
      monthlyHint: paypal.monthlyBurden > 0 ? paypal.monthlyBurden : null,
      pct: pct(paypalRepaid, paypalTotal),
      hint:
        activePaypal > 0
          ? `${activePaypal} piani attivi · ${formatEur(paypal.monthlyBurden)}/m stimati`
          : "Nessun piano attivo nei CSV",
      phase: paypalUnder600
        ? "Fase Selfy: valuta colpo parziale"
        : `Prima chiudi sotto ${formatEur(LIBERATION_DEFAULTS.paypalPhaseThreshold)} residuo`,
    },
    {
      id: "selfy",
      label: "Selfycredit Instant",
      kind: "debt",
      current: round2(selfyRepaid),
      target: selfyPrincipal,
      remaining: round2(selfyRemaining),
      monthlyHint: selfyInstallment > 0 ? selfyInstallment : null,
      pct: pct(selfyRepaid, selfyPrincipal),
      hint: `${formatEur(selfyInstallment)}/m · ${selfyRemainingInstallments} rate rimaste`,
      phase: !paypalUnder600
        ? "Dopo PayPal sotto controllo"
        : selfyRepaid < LIBERATION_DEFAULTS.selfyPartialPayoff
          ? `Prossimo colpo: ${formatEur(LIBERATION_DEFAULTS.selfyPartialPayoff)}`
          : "Estinzione parziale in corso",
    },
    {
      id: "viaggio",
      label: "Pocket Viaggio",
      kind: "savings",
      current: round2(viaggioCurrent),
      target: LIBERATION_DEFAULTS.viaggioAnnualTarget,
      remaining: round2(Math.max(0, LIBERATION_DEFAULTS.viaggioAnnualTarget - viaggioCurrent)),
      monthlyHint: LIBERATION_DEFAULTS.viaggioMonthly,
      pct: pct(viaggioCurrent, LIBERATION_DEFAULTS.viaggioAnnualTarget),
      hint: `Accantona ${formatEur(LIBERATION_DEFAULTS.viaggioMonthly)}/m · weekend e ponti`,
      phase: viaggioCurrent < 300 ? "Ricarica dopo Valencia" : null,
    },
    {
      id: "lifecycle",
      label: "Lifecycle / Tech",
      kind: "savings",
      current: lifecycleCurrent,
      target: LIBERATION_DEFAULTS.lifecycleTarget,
      remaining: round2(Math.max(0, LIBERATION_DEFAULTS.lifecycleTarget - lifecycleCurrent)),
      monthlyHint: LIBERATION_DEFAULTS.lifecycleMonthly,
      pct: pct(lifecycleCurrent, LIBERATION_DEFAULTS.lifecycleTarget),
      hint:
        lifecycleCurrent > 0
          ? `Pocket Tech rilevato · obiettivo ${formatEur(LIBERATION_DEFAULTS.lifecycleTarget)}`
          : `Accantona ${formatEur(LIBERATION_DEFAULTS.lifecycleMonthly)}/m — «Accredita EUR Tech» su Risparmi`,
      phase: null,
    },
  ];

  return { goals, paypalUnder600, liberabileEstimate: liberabile };
}
