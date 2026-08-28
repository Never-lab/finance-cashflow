/** Owner-known accounts: internal moves, excluded from cash-flow KPI. */

export type KnownAccount = {
  id: string;
  /** IBAN without spaces, uppercase */
  iban: string;
  label: string;
};

/** Mediolanum conto deposito — fondo emergenza ufficiale (Nicholas Antinori). */
export const EMERGENCY_FUND_DEPOSIT: KnownAccount = {
  id: "mediolanum-emergency-deposit",
  iban: "IT02J0306234210000060114212",
  label: "Fondo emergenza Mediolanum",
};

export const KNOWN_INTERNAL_ACCOUNTS: KnownAccount[] = [EMERGENCY_FUND_DEPOSIT];

export function normalizeIban(raw: string): string {
  return raw.replace(/\s/g, "").toUpperCase();
}

export function matchKnownAccount(text: string): KnownAccount | null {
  const hay = normalizeIban(text);
  for (const acc of KNOWN_INTERNAL_ACCOUNTS) {
    if (hay.includes(acc.iban)) return acc;
  }
  return null;
}

export function isEmergencyFundTransfer(t: { description: string }): boolean {
  if (matchKnownAccount(t.description)) return true;
  return /fondo emergenza mediolanum/i.test(t.description);
}

/** Outflows to emergency deposit (absolute €). */
export function sumEmergencyFundOutflows(
  txns: { description: string; amount: number }[],
): number {
  return txns
    .filter((t) => t.amount < 0 && isEmergencyFundTransfer(t))
    .reduce((s, t) => s + -t.amount, 0);
}
